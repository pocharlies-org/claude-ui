# CLAUDE.md — claude-ui

## Project Overview

Claude-UI is a **Claude Agent Orchestration Platform** — a web UI + MCP server for running `claude` CLI sessions. Sessions can be triggered manually, via webhook, cron, or by OpenClaw/moltbot.

- **GitHub**: `https://github.com/pocharlies/claude-ui` (branch: `feature/initial-implementation`)
- **Cluster**: `infra-virtuozzo`, namespace `devopsai`
- **Registry**: `a8n-docker.repo.com.int.zone/devopsai/claude-ui`

## Architecture

```
Browser → Next.js (port 3000)
             ├── /sessions      — manage claude CLI session configs
             ├── /executions    — view real-time streaming output (xterm.js SSE)
             ├── /crons         — scheduled executions (node-cron)
             ├── /webhooks      — webhook tokens per session
             └── /settings      — app config

Next.js instrumentation.ts → starts MCP server (port 3100) + cron scheduler + orphan recovery on boot

MCP Server (port 3100, SSE transport) — tools: execute_session, list_sessions, get_execution
OpenClaw/moltbot → mcp-proxy port 3007 → supergateway --sse "http://claude-ui:3100/sse"
```

## Tech Stack

| Concern | Library / Version |
|---------|------------------|
| Framework | Next.js 16 (App Router, `--src-dir`, `output: standalone`) |
| Language | TypeScript (strict) |
| DB | SQLite via Prisma v7 + `@prisma/adapter-libsql` + `@libsql/client` |
| UI | shadcn/ui v4 + Tailwind CSS |
| Terminal | xterm.js (`@xterm/xterm`, `@xterm/addon-fit`) |
| Cron | node-cron v4 |
| MCP | `@modelcontextprotocol/sdk` |
| Auth | Bearer token (`CLAUDE_UI_SECRET`) — **see Pending Work below for planned Google OAuth** |
| Testing | Vitest (32 tests, 7 test files) |
| Logging | pino |

## Key Technical Facts

### Prisma v7 + SQLite
- `DATABASE_URL` goes in **both** `prisma.config.ts` (for CLI) AND read at runtime in `src/lib/db.ts`
- Do NOT put `url =` in `schema.prisma` datasource block — Prisma v7 SQLite uses driver adapters
- `PrismaLibSql({ url })` — lowercase `ql`, takes config object (not a pre-created client)
- `previewFeatures = ["driverAdapters"]` is deprecated in v7 — remove it

### Claude CLI Auth (Teams OAuth)
- The executor spawns `claude` with `{ env: { ...process.env } }` — inherits env credentials
- Auth uses Teams/Pro OAuth: `~/.claude/.credentials.json` mounted into the container
- In K8s: credentials file stored in the Helm secret as `credentials.json` key, mounted at `/root/.claude/.credentials.json` via subPath
- No `ANTHROPIC_API_KEY` env var — use credentials file only

### vitest
- **Must** exclude `.next` in `vitest.config.ts`: `exclude: ['node_modules', '.next', 'dist']`
- Without this, vitest picks up sonic-boom tap tests from `.next/standalone/node_modules` (30 failures)

### Dockerfile
- Multi-stage: builder (all deps + compile) → runner (standalone + claude CLI global install)
- `@libsql` must be explicitly copied in runner stage: `COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql`
- Creates `/root/.claude` as mount point for credentials
- Runs `npx prisma migrate deploy` before `node server.js` at startup

### EventSource auth
- SSE endpoints accept auth via `?token=` query param (browser can't set Authorization header for EventSource)
- Server checks `token` query param as fallback to `Authorization: Bearer` header

## Build & Development Commands

```bash
npm ci                          # install deps (also runs prisma generate via postinstall)
npm run dev                     # Next.js dev server
npm run build                   # production build
npm test                        # vitest run (32 tests)
npm run test:coverage           # vitest with coverage (threshold: 80%)
npm run lint                    # eslint
npx prisma migrate dev          # apply migrations in dev
npx prisma migrate deploy       # apply migrations in prod
```

## Project Structure

```
src/
  app/
    api/
      execute/route.ts          — POST trigger execution
      executions/[id]/stream/   — SSE stream for real-time output
      sessions/                 — CRUD for sessions
      crons/                    — CRUD + toggle for cron jobs
      webhooks/                 — CRUD for webhook tokens
      health/route.ts           — liveness check
      litellm/mcp-servers/      — list MCP servers from LiteLLM
    sessions/                   — UI pages
    executions/
    crons/
    webhooks/
    settings/
  lib/
    auth.ts                     — validateBearerToken, unauthorizedResponse
    db.ts                       — Prisma v7 + libsql client singleton
    executor.ts                 — spawn claude CLI, SSE broadcast, orphan recovery
    api.ts                      — shared fetch client with error handling
    logger.ts                   — pino logger
  mcp/
    server.ts                   — MCP server on port 3100
    handlers.ts                 — execute_session, list_sessions, get_execution tools
  cron/
    scheduler.ts                — node-cron scheduler
  instrumentation.ts            — Next.js boot hook: starts MCP + cron + orphan recovery
  components/
    nav.tsx                     — sidebar navigation
prisma/
  schema.prisma                 — Session, Execution, CronJob, WebhookToken models
  prisma.config.ts              — DATABASE_URL for Prisma CLI
charts/claude-ui/               — Helm chart (lints clean)
Dockerfile                      — multi-stage build
bitbucket-pipelines.yml         — CI/CD pipeline
```

## Deployment

### K8s Secrets (create before first Helm install)

```bash
# Create the claude-ui app secret
kubectl create secret generic claude-ui --namespace devopsai \
  --from-literal=CLAUDE_UI_SECRET=$(openssl rand -hex 32) \
  --from-literal=LITELLM_API_KEY=<litellm-master-key> \
  --from-file=credentials.json=~/.claude/.credentials.json
```

### Helm Deploy

```bash
helm upgrade --install claude-ui charts/claude-ui \
  --namespace devopsai \
  --set image.tag=<commit-sha> \
  --set secrets.claudeUiSecret=$CLAUDE_UI_SECRET \
  --set secrets.litellmApiKey=$LITELLM_API_KEY \
  --set ingress.host=claude-ui.com.int.zone \
  --wait --timeout 5m
```

### Helm values defaults

```yaml
image.repository: a8n-docker.repo.com.int.zone/devopsai/claude-ui
persistence.size: 5Gi
env.LITELLM_URL: "http://litellm:4000"
env.DATABASE_URL: "file:/data/db.sqlite"
```

### OpenClaw integration (moltbot mcp-proxy)

Port 3007 in `moltbot/mcp-proxy/start.sh`:
```sh
supergateway --port 3007 --sse "http://claude-ui:3100/sse" &
```

## Authentication Architecture

### Google OAuth (Browser Users)
- **NextAuth.js v5** with Google provider, restricted to `@cloudblue.com` domain
- Route protection via Next.js middleware — unauthenticated requests redirect to `/login`
- Excluded routes: `/api/auth`, `/api/health`, `/api/webhook` (machine-to-machine)
- Session enrichment: `user.id`, `user.isAdmin`, `user.hasCredentials`

### Bearer Token (Machine-to-Machine)
- Webhooks, MCP server, and scripts still use `Authorization: Bearer $CLAUDE_UI_SECRET`
- SSE stream accepts both NextAuth cookies and `?token=` query param

### Dual Auth
All API routes use `validateRequest()` which tries NextAuth session first, then falls back to bearer token. Both return an `AuthResult` used for ownership checks.

### Per-User Claude Credentials
- Users upload `~/.claude/.credentials.json` via Settings page
- Credentials encrypted with AES-256-GCM, stored in `User.encryptedCredentials`
- On execution: decrypted → written to temp `HOME/.claude/.credentials.json` → claude CLI spawned with custom `HOME` → temp files cleaned up after completion
- Users without credentials linked get 403 on execution attempts

### User-Scoped Visibility
- Sessions, executions, crons, webhooks filtered by `createdBy` (ownership)
- Admins (`User.isAdmin = true`) see all resources
- `ADMIN_EMAIL` env var auto-promotes a user to admin on startup

### Pre-requisite: Google OAuth Credentials
Create a Google OAuth app in Google Cloud Console:
- Authorized redirect: `https://claude-ui.com.int.zone/api/auth/callback/google`
- Restricted to `cloudblue.com` in OAuth consent screen

## Pending Work

- **Integration/E2E tests** for the full auth flow (login → upload credentials → execute)
- **Rate limiting** on credential upload endpoint
- **Credential rotation** — notification when credentials expire

## Auto-Commit Rule

After any file change: `git add <files> && git commit -m "<type>: <desc>" && git push origin feature/initial-implementation`
