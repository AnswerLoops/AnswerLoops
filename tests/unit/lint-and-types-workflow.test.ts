import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Guards the lint-and-types CI job. Without this, deleting the job or moving
 * the fumadocs-mdx step after pnpm typecheck would fail nothing locally —
 * `.source` exists on a developer's machine but is generated and gitignored,
 * so only a fresh CI checkout reveals the ordering dependency, and only as a
 * red build on main.
 */
describe('lint-and-types CI job', () => {
  async function job(): Promise<string> {
    const ci = await readFile(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8')
    const start = ci.indexOf('\n  lint-and-types:')
    expect(start, 'lint-and-types job is missing from ci.yml').toBeGreaterThan(-1)
    // Slice to the next job at the same indent, or EOF when it is the last one.
    const rest = ci.slice(start + 1)
    const next = rest.search(/\n {2}[a-z][a-z0-9-]*:\n/)
    return next === -1 ? rest : rest.slice(0, next)
  }

  it('runs lint, typecheck and the e2e typecheck', async () => {
    const block = await job()

    expect(block).toContain('run: pnpm lint')
    expect(block).toContain('run: pnpm typecheck')
    expect(block).toContain('run: pnpm test:e2e:typecheck')
  })

  it('generates .source before type-checking, since tsc cannot resolve @/.source/server without it', async () => {
    const block = await job()

    const generate = block.indexOf('pnpm exec fumadocs-mdx')
    const typecheck = block.indexOf('pnpm typecheck')

    expect(generate, 'fumadocs-mdx step is missing').toBeGreaterThan(-1)
    expect(generate).toBeLessThan(typecheck)
  })

  it('installs from the lockfile on the same node and pnpm majors as test-and-build', async () => {
    const block = await job()

    expect(block).toContain('pnpm install --frozen-lockfile')
    expect(block).toContain('node-version: 22')
    expect(block).toContain('version: 11')
    // Least-privilege and no credential persistence, matching the sibling jobs.
    expect(block).toContain('contents: read')
    expect(block).toContain('persist-credentials: false')
  })

  it('backs the typecheck step with a real package.json script', async () => {
    const pkg = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8'))

    expect(pkg.scripts.typecheck).toBe('tsc --noEmit')
    expect(pkg.scripts['test:e2e:typecheck']).toBe('tsc --noEmit -p e2e/tsconfig.json')
  })
})
