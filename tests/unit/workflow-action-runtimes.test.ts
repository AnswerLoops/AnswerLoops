import { describe, expect, it } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Guards the Actions runtime the workflows execute on.
 *
 * GitHub deprecated the Node 20 runtime and currently forces Node 20 actions
 * onto Node 24 anyway, so a workflow pinned to a Node 20 major keeps passing —
 * it just runs on a runtime it was never tested against, behind a shim that is
 * explicitly temporary. Nothing goes red when someone re-pins an action back
 * to a Node 20 major, which is exactly why this needs a test rather than a
 * comment.
 *
 * The floors below are the first major of each action whose `action.yml`
 * declares `runs.using: node24`, read from the action repositories rather than
 * inferred from release notes — several actions announced Node 24 support a
 * major before the runtime actually changed.
 */
const NODE24_FLOOR: Record<string, number> = {
  'actions/checkout': 5,
  'actions/setup-node': 5,
  'actions/upload-artifact': 6,
  'actions/download-artifact': 7,
  'pnpm/action-setup': 5,
  'docker/setup-buildx-action': 4,
  'docker/login-action': 4,
  'docker/build-push-action': 7,
  'docker/metadata-action': 6,
}

/**
 * Composite actions run their steps on the runner's own shell and declare no
 * Node runtime, so the deprecation does not reach them and there is no major
 * to floor.
 */
const COMPOSITE_ACTIONS = new Set(['aquasecurity/trivy-action'])

interface Pin {
  file: string
  line: number
  action: string
  sha: string
  comment: string
}

async function pins(): Promise<Pin[]> {
  const dir = path.join(process.cwd(), '.github/workflows')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  const found: Pin[] = []

  for (const file of files) {
    const lines = (await readFile(path.join(dir, file), 'utf8')).split('\n')
    lines.forEach((text, index) => {
      const match = text.match(/^\s*(?:-\s+)?uses:\s*(\S+?)@(\S+)(?:\s+#\s*(.*))?$/)
      if (!match) return
      found.push({
        file,
        line: index + 1,
        action: match[1],
        sha: match[2],
        comment: (match[3] ?? '').trim(),
      })
    })
  }

  return found
}

describe('workflow action runtimes', () => {
  it('pins every action to a full commit SHA with a readable version comment', async () => {
    for (const pin of await pins()) {
      const where = `${pin.file}:${pin.line} (${pin.action})`

      expect(pin.sha, `${where} is not pinned to a full commit SHA`).toMatch(/^[a-f0-9]{40}$/)
      expect(pin.comment, `${where} has no version comment saying what the SHA is`).not.toBe('')
    }
  })

  it('keeps every Node-based action on a major that ships the Node 24 runtime', async () => {
    for (const pin of await pins()) {
      if (COMPOSITE_ACTIONS.has(pin.action)) continue

      const floor = NODE24_FLOOR[pin.action]
      const where = `${pin.file}:${pin.line} (${pin.action})`

      // An action nobody has classified is the real hazard: it can be added on
      // a Node 20 major and this test would otherwise wave it through.
      expect(
        floor,
        `${where} is not in NODE24_FLOOR — check its action.yml for runs.using and add it, ` +
          'or add it to COMPOSITE_ACTIONS if it declares using: composite',
      ).toBeDefined()

      const major = Number(pin.comment.match(/^v(\d+)/)?.[1])
      expect(major, `${where} comment "${pin.comment}" does not start with a vN version`).not.toBeNaN()
      expect(
        major,
        `${where} is pinned to v${major}, which runs on the deprecated Node 20 runtime — v${floor} is the first Node 24 major`,
      ).toBeGreaterThanOrEqual(floor)
    }
  })

  it('covers the workflows that actually exist', async () => {
    const all = await pins()
    const files = new Set(all.map((p) => p.file))

    // Cheap canary: if a workflow file is renamed or the uses: regex stops
    // matching, the two tests above would pass vacuously on an empty list.
    expect(all.length).toBeGreaterThan(20)
    expect(files).toContain('ci.yml')
    expect(files).toContain('publish-image.yml')
    expect(files).toContain('security.yml')
  })
})
