import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Dependabot exists mainly to stop the CI security scanners (semgrep, zizmor,
// the trivy-action digest) from drifting silently. These lock in that wiring:
// the tools are version-pinned, the workflow installs the pinned file, and
// Dependabot watches both the pip file and the GitHub Actions. String
// assertions, matching the other workflow tests in this repo.

const ROOT = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf-8')

describe('.github/security-tools/requirements.txt', () => {
  const reqs = read('.github/security-tools/requirements.txt')

  it('pins semgrep and zizmor to an exact version', () => {
    expect(reqs).toMatch(/^semgrep==\d+\.\d+\.\d+/m)
    expect(reqs).toMatch(/^zizmor==\d+\.\d+\.\d+/m)
  })

  it('is what the security workflow installs — no bare `pip install <tool>` left', () => {
    const wf = read('.github/workflows/security.yml')
    expect(wf).not.toMatch(/pip install (semgrep|zizmor)(\s|$)/)
    const installs = [...wf.matchAll(/pip install -r (\S+)/g)].map((m) => m[1])
    expect(installs.length).toBe(2) // semgrep job + zizmor job
    for (const p of installs) expect(p).toBe('.github/security-tools/requirements.txt')
  })
})

describe('.github/dependabot.yml', () => {
  const cfg = read('.github/dependabot.yml')

  it('is a v2 config', () => {
    expect(cfg).toMatch(/^version:\s*2\s*$/m)
  })

  it('watches the pinned security-tools pip file weekly', () => {
    const pip = cfg.slice(cfg.indexOf('package-ecosystem: pip'))
    expect(pip).toContain('directory: /.github/security-tools')
    expect(pip.slice(0, pip.indexOf('package-ecosystem: github-actions'))).toMatch(/interval:\s*weekly/)
  })

  it('watches the SHA-pinned GitHub Actions (keeps the trivy-action digest moving)', () => {
    expect(cfg).toContain('package-ecosystem: github-actions')
    const gha = cfg.slice(cfg.indexOf('package-ecosystem: github-actions'))
    expect(gha).toMatch(/directory:\s*\/\s*$/m)
  })
})
