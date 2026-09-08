// Read-only Neon diagnostic. Reads DATABASE_URL / DIRECT_DATABASE_URL from
// .env and NEVER prints the connection string. Delete this file when done.
//
// NOTE: connecting wakes the compute, which resets the idle timer. That is
// unavoidable, and it is also the measurement: pg_postmaster_start_time()
// reports when the compute last started, i.e. before this connection.
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

function fromEnvFile(name) {
  for (const f of ['.env', '.env.local']) {
    try {
      const line = readFileSync(f, 'utf8')
        .split('\n')
        .find((l) => l.trim().startsWith(name + '='))
      if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
    } catch {}
  }
  return process.env[name]
}

const url = fromEnvFile('DIRECT_DATABASE_URL') || fromEnvFile('DATABASE_URL')
if (!url) {
  console.error('No DATABASE_URL found in .env, .env.local, or the environment.')
  process.exit(1)
}

const sql = postgres(url, { max: 1, idle_timeout: 5 })

const [up] = await sql`
  SELECT pg_postmaster_start_time() AS started,
         date_trunc('second', now() - pg_postmaster_start_time()) AS uptime,
         current_setting('server_version') AS version
`
console.log('\n=== Compute uptime ===')
console.log('Postgres started :', up.started.toISOString())
console.log('Up for           :', up.uptime)
console.log(
  '\nReading: uptime of minutes = it was suspended and this connection just woke it.'
)
console.log('           uptime of days    = it has not suspended in that long.\n')

const conns = await sql`
  SELECT COALESCE(application_name, '(none)') AS app,
         state,
         count(*)::int AS n,
         date_trunc('second', now() - min(backend_start)) AS oldest
  FROM pg_stat_activity
  WHERE datname = current_database() AND pid <> pg_backend_pid()
  GROUP BY 1, 2 ORDER BY n DESC
`
console.log('=== Other connections open right now ===')
if (conns.length === 0) console.log('(none — nothing else is holding the compute open)')
for (const c of conns) {
  console.log(`${String(c.n).padStart(3)}  ${c.state ?? 'unknown'}  ${c.app}  (oldest ${c.oldest})`)
}

const [listeners] = await sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event = 'ClientRead' AND query ILIKE 'listen%'`
console.log(`\nLISTEN connections: ${listeners.n}`)
console.log('(one per open dashboard tab is expected after PR #129; two per tab would mean it regressed)\n')

await sql.end()
