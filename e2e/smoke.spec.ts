import { test, expect } from '@playwright/test'
import { ingest, waitForAssessment, readTicketRow } from './helpers'

// Proves the harness end-to-end: bot ingest -> triage -> embed -> agent ->
// assess, all under AIMock, with the result observable in the DB and the UI.
test.describe('smoke: ingest pipeline', () => {
  test('a confident question is triaged, answered, and auto-deflected', async ({ request, page }) => {
    const ticketId = await ingest(request, {
      content: 'How do I configure the client connection?',
    })
    expect(ticketId).toBeGreaterThan(0)

    // Triage ran synchronously during ingest.
    const row = readTicketRow(ticketId)!
    expect(row.category).toBe('how_to')

    // Background agent + assess finish shortly after.
    const assessment = await waitForAssessment(ticketId)
    expect(assessment.confidence).toBeGreaterThanOrEqual(0.8)
    expect(assessment.auto_deflected).toBe(1)

    // And it renders on the ticket detail page.
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByText('AI Confidence')).toBeVisible()
    await expect(page.getByText(/auto-answered/i).first()).toBeVisible()
  })

  test('an unsure answer is routed to a human', async ({ request }) => {
    const ticketId = await ingest(request, {
      content: 'Something weird is happening with my setup [[needhuman]]',
    })
    const assessment = await waitForAssessment(ticketId)
    expect(assessment.auto_deflected).toBe(0)
    expect(assessment.confidence).toBeLessThan(0.8)
  })
})
