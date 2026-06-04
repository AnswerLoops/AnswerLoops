import { getDb } from '../index'
import type { GitHubRepo } from '@/types'

export function getRepos(): GitHubRepo[] {
  return getDb().prepare('SELECT * FROM github_repos ORDER BY added_at DESC').all() as GitHubRepo[]
}

export function addRepo(installationId: number, owner: string, repo: string, isPrivate: boolean): GitHubRepo {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO github_repos (installation_id, owner, repo, is_private)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(owner, repo) DO UPDATE SET installation_id = excluded.installation_id, is_private = excluded.is_private
  `).run(installationId, owner, repo, isPrivate ? 1 : 0)
  return db.prepare('SELECT * FROM github_repos WHERE id = ?').get(result.lastInsertRowid) as GitHubRepo
}

export function removeRepo(id: number): void {
  getDb().prepare('DELETE FROM github_repos WHERE id = ?').run(id)
}
