# Community Support Platform

Turn a stream of community questions into a self-improving knowledge base that deflects repeat questions — automatically, with humans only on the long tail.

## Stack

- **Next.js 16** (App Router) — dashboard + API routes
- **Discord bot** — ingests community questions, posts AI answers
- **SQLite** (better-sqlite3, WAL) — single-file database
- **OpenAI** — triage, embeddings, agent, reviewer
- **Resend** — email notifications (optional)
- **Docker** — app + bot as separate services

---

## Quick start (local dev)

```bash
git clone https://github.com/NathanTarbert/community-platform.git
cd community-platform
pnpm install
cp .env.local.example .env.local   # fill in values (see below)
pnpm dev
```

App at `http://localhost:3000` — log in at `/login` with `STAFF_PASSWORD`.

Run the bot in a second terminal:

```bash
pnpm bot
```

---

## Environment variables

### Required

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Powers triage, embeddings, agent, reviewer |
| `SESSION_SECRET` | Signs auth cookies — `openssl rand -hex 32` |
| `STAFF_PASSWORD` | Dashboard login password |
| `BOT_SECRET` | Shared secret between bot and `/api/ingest` — `openssl rand -hex 32` |
| `AUTH_URL` | Full public URL e.g. `https://yourapp.up.railway.app` |

### Discord bot

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID |
| `DISCORD_GUILD_ID` | Server ID (right-click server → Copy Server ID) |

### Optional — email notifications

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | API key from resend.com |
| `RESEND_FROM` | Verified sender e.g. `notifications@yourdomain.com` |

### Optional — web push

Generate VAPID keys: `pnpm dlx web-push generate-vapid-keys`

| Variable | Description |
|----------|-------------|
| `VAPID_PUBLIC_KEY` | Public VAPID key |
| `VAPID_PRIVATE_KEY` | Private VAPID key |
| `VAPID_EMAIL` | `mailto:you@yourdomain.com` |

### Optional — GitHub App (source-code search)

| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | App ID from GitHub App settings |
| `GITHUB_PRIVATE_KEY` | PEM key |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret |

---

## Production (Docker)

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Check logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f bot
```

> The `community-data` Docker volume holds `community.db`. Never delete it unless intentionally resetting all data.

---

## Deployment

See the [Production Setup Guide](https://app.notion.com/p/3822539abb6b8124a3dbf687e54c85ce) in Notion for step-by-step instructions covering Railway, Fly.io, Discord bot configuration, and end-to-end verification.

Recommended hosts: **Railway** or **Fly.io** — both support persistent volumes for SQLite and separate services for the bot.

---

## Architecture

Full architecture doc: `docs/ARCHITECTURE.md`  
Build plan and roadmap: `docs/BUILD-PLAN.md`
