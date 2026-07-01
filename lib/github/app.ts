import { Octokit } from '@octokit/rest'
import { getRepos } from '@/lib/db/queries/github'

let appInstance: InstanceType<typeof import('@octokit/app').App> | null = null

async function getApp() {
  if (!appInstance) {
    const { App } = await import('@octokit/app')
    const privateKey = Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY ?? '', 'base64').toString('utf8')
    appInstance = new App({
      appId: process.env.GITHUB_APP_ID!,
      privateKey,
    })
  }
  return appInstance
}

export async function getInstallationOctokit(owner: string, repo: string): Promise<Octokit> {
  const repos = await getRepos()
  const repoRecord = repos.find((r) => r.owner === owner && r.repo === repo)

  if (!repoRecord) {
    throw new Error(`Repository ${owner}/${repo} is not configured`)
  }

  const app = await getApp()
  const octokit = await app.getInstallationOctokit(repoRecord.installation_id)
  return octokit as unknown as Octokit
}

export async function getConfiguredRepos(): Promise<string[]> {
  const repos = await getRepos()
  return repos.map((r) => `${r.owner}/${r.repo}`)
}
