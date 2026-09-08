import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  API_SCOPES,
  ALL_SCOPES,
  FULL_SCOPES,
  READONLY_SCOPES,
  TOOL_SCOPES,
  isApiScope,
  normalizeScopes,
  hasScope,
} from '../../lib/agent/scopes'

describe('lib/agent/scopes', () => {
  it('every MCP tool maps to a real, known scope', () => {
    for (const [tool, scope] of Object.entries(TOOL_SCOPES)) {
      expect(isApiScope(scope), `${tool} → ${scope}`).toBe(true)
    }
  })

  it('the readonly preset contains only read scopes', () => {
    for (const scope of READONLY_SCOPES) {
      expect(scope.endsWith(':read'), scope).toBe(true)
    }
    expect(READONLY_SCOPES).not.toContain('tickets:write')
    expect(READONLY_SCOPES).not.toContain('answers:write')
  })

  it('FULL_SCOPES is the complete catalogue', () => {
    expect([...FULL_SCOPES].sort()).toEqual([...ALL_SCOPES].sort())
    expect([...ALL_SCOPES].sort()).toEqual(Object.keys(API_SCOPES).sort())
  })

  describe('normalizeScopes', () => {
    it('drops unknown entries rather than trusting them', () => {
      expect(normalizeScopes(['kb:read', 'kb:delete', 'tickets:write', 42, null])).toEqual([
        'kb:read',
        'tickets:write',
      ])
    })

    it('de-duplicates', () => {
      expect(normalizeScopes(['kb:read', 'kb:read'])).toEqual(['kb:read'])
    })

    it('falls back to full access for a NULL / non-array / empty / all-invalid value', () => {
      const full = [...FULL_SCOPES].sort()
      expect(normalizeScopes(null).sort()).toEqual(full)
      expect(normalizeScopes(undefined).sort()).toEqual(full)
      expect(normalizeScopes([]).sort()).toEqual(full)
      expect(normalizeScopes(['nonsense', 'also:bad']).sort()).toEqual(full)
      expect(normalizeScopes('kb:read').sort()).toEqual(full)
    })
  })

  describe('hasScope', () => {
    it('is an exact-membership check (no wildcard / hierarchy)', () => {
      expect(hasScope(['kb:read', 'tickets:read'], 'kb:read')).toBe(true)
      expect(hasScope(['kb:read'], 'tickets:write')).toBe(false)
      expect(hasScope([], 'kb:read')).toBe(false)
    })
  })
})

describe('migration 0038 backfills existing keys to full access', () => {
  const sql = readFileSync(resolve(process.cwd(), 'drizzle/0038_api_key_scopes.sql'), 'utf-8')

  it('adds the column idempotently with the full-scope default', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS scopes TEXT[]')
    for (const scope of ALL_SCOPES) {
      expect(sql, scope).toContain(`'${scope}'`)
    }
  })

  it('backfills NULL / empty rows so no existing key loses access', () => {
    expect(sql).toMatch(/UPDATE api_keys[\s\S]+WHERE scopes IS NULL OR cardinality\(scopes\) = 0/)
  })
})
