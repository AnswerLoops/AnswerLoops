// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AnimatedChat } from '@/components/animated-chat'

// Component drives its own timeline via chained setTimeout calls (typing
// animation + scene transitions) — fake timers let the test assert each
// stage deterministically instead of racing real wall-clock delays.
describe('AnimatedChat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the channel chrome immediately, before any typing starts', () => {
    render(<AnimatedChat />)
    expect(screen.getAllByText('support', { exact: false }).length).toBeGreaterThan(0)
    expect(screen.getByText('devtools community')).toBeInTheDocument()
  })

  it('types the user question, then the AI thinking indicator, then the AI reply with a docs link', () => {
    render(<AnimatedChat />)

    // Initial delay + full user message typed (100 chars * 28ms + buffer)
    act(() => {
      vi.advanceTimersByTime(700 + 100 * 28 + 200)
    })
    expect(screen.getByText('jordan_dev')).toBeInTheDocument()
    expect(screen.getByText(/Can't seem to get the webhooks to fire/)).toBeInTheDocument()

    // AI thinking delay, then full AI reply typed (147 chars * 28ms + buffer)
    act(() => {
      vi.advanceTimersByTime(1000 + 147 * 28 + 200)
    })
    expect(screen.getAllByText('AnswerLoops').length).toBeGreaterThan(0)
    expect(screen.getByText(/webhook signature validation was tightened/)).toBeInTheDocument()
    expect(screen.getByText('Webhook Setup Guide →')).toBeInTheDocument()
  })

  it('crossfades into the dashboard scene with a 95% auto-answered badge after the reply completes', () => {
    render(<AnimatedChat />)

    // Run the full chat exchange, then the after-reply pause + scene switch + badge reveal delay
    act(() => {
      vi.advanceTimersByTime(700 + 100 * 28 + 1000 + 147 * 28 + 900 + 500 + 200)
    })

    expect(screen.getByText("Can't get webhooks to fire for social media scheduling tool")).toBeInTheDocument()
    expect(screen.getByText('Auto-answered · 95%')).toBeInTheDocument()
    expect(screen.getByText('Resolved automatically — no human review needed')).toBeInTheDocument()
  })

  it('loops back to the chat scene after the dashboard hold ends', () => {
    render(<AnimatedChat />)

    const toDashboard = 700 + 100 * 28 + 1000 + 147 * 28 + 900 + 500 + 200
    act(() => {
      vi.advanceTimersByTime(toDashboard)
    })
    expect(screen.getByText('Auto-answered · 95%')).toBeInTheDocument()

    // Hold (3600ms) + restart delay, then enough time to start retyping the user message
    act(() => {
      vi.advanceTimersByTime(3600 + 500 + 300)
    })
    // The dashboard scene stays mounted (crossfade via opacity, not unmount) —
    // the badge itself resets to its hidden state rather than leaving the DOM.
    expect(screen.getByText('Auto-answered · 95%')).toHaveClass('opacity-0')
    expect(screen.getByText('jordan_dev')).toBeInTheDocument()
  })

  it('cleans up all pending timers on unmount without throwing', () => {
    const { unmount } = render(<AnimatedChat />)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(() => unmount()).not.toThrow()
    // No further state updates should fire after unmount (would log an act() warning if they did)
    act(() => {
      vi.advanceTimersByTime(20000)
    })
  })
})
