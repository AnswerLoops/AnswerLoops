import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../drizzle'
import { githubRepos, DEFAULT_ORG_ID } from '../schema'
import type { GitHubRepo } from '@/types'

function toRepo(row: typeof githubRepos.$inferSelect): GitHubRepo {
  return {
    id: row.id,
    installation_id: row.installationId,
    owner: row.owner,
    repo: row.repo,
    is_private: row.isPrivate as 0 | 1,
    added_at: row.addedAt,
  }
}

export async function getRepos(orgId = DEFAULT_ORG_ID): Promise<GitHubRepo[]> {
  const rows = await getDb()
    .select()
    .from(githubRepos)
    .where(eq(githubRepos.orgId, orgId))
    .orderBy(desc(githubRepos.addedAt))
  return rows.map(toRepo)
}

export async function addRepo(
  installationId: number,
  owner: string,
  repo: string,
  isPrivate: boolean,
  orgId = DEFAULT_ORG_ID
): Promise<GitHubRepo> {
  const [row] = await getDb()
    .insert(githubRepos)
    .values({ orgId, installationId, owner, repo, isPrivate: isPrivate ? 1 : 0 })
    .onConflictDoUpdate({
      target: [githubRepos.owner, githubRepos.repo],
      set: { installationId, isPrivate: isPrivate ? 1 : 0 },
    })
    .returning()
  return toRepo(row)
}

export async function removeRepo(id: number): Promise<void> {
  await getDb().delete(githubRepos).where(eq(githubRepos.id, id))
}
