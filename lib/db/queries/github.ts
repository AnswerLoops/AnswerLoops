import { eq, and } from 'drizzle-orm'
import { getDrizzle } from '../drizzle'
import { getDb } from '../index'
import { githubRepos, DEFAULT_ORG_ID } from '../schema'
import type { GitHubRepo } from '@/types'

function dz() { return getDrizzle() }
function raw() { return getDb() }

export function getRepos(orgId = DEFAULT_ORG_ID): GitHubRepo[] {
  return raw()
    .prepare('SELECT * FROM github_repos WHERE org_id = ? ORDER BY added_at DESC')
    .all(orgId) as GitHubRepo[]
}

export function addRepo(installationId: number, owner: string, repo: string, isPrivate: boolean, orgId = DEFAULT_ORG_ID): GitHubRepo {
  const result = dz()
    .insert(githubRepos)
    .values({ orgId, installationId, owner, repo, isPrivate: isPrivate ? 1 : 0 })
    .onConflictDoUpdate({
      target: [githubRepos.owner, githubRepos.repo],
      set: { installationId, isPrivate: isPrivate ? 1 : 0 },
    })
    .run()

  return raw()
    .prepare('SELECT * FROM github_repos WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as GitHubRepo
}

export function removeRepo(id: number): void {
  dz().delete(githubRepos).where(eq(githubRepos.id, id)).run()
}
