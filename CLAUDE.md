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

## Pending Work

### IN PROGRESS — Google OAuth + Per-User Claude Credentials (BRAINSTORMING PHASE)

The next feature being designed is replacing the shared `CLAUDE_UI_SECRET` bearer token with proper user authentication:

**What the user wants:**
1. Replace current shared-secret auth with Google OAuth restricted to `@cloudblue.com` domain
2. Each cloudblue.com user can link their own Claude account credentials
3. When a user triggers executions, their Claude credentials are used (not a shared org key)
4. Possibly: a UI flow to link Claude account (upload `~/.claude/.credentials.json` or OAuth flow)

**Brainstorming was in progress** — the key open question was:
- Option A: Each user brings their own Claude credentials (personal account, per-user billing)
- Option B: One shared Claude org/Teams credential, Google OAuth controls access to the UI
- Option C: Both — Google OAuth for access + optional per-user Claude credential override

**When resuming:** Continue the brainstorming session by checking where we left off, then proceed to:
1. Finish clarifying questions
2. Propose 2-3 approaches
3. Present design for approval
4. Write spec → `docs/superpowers/specs/YYYY-MM-DD-google-oauth-claude-credentials-design.md`
5. Write implementation plan → `docs/superpowers/plans/`
6. Execute plan with subagent-driven-development

**Technical constraints to keep in mind:**
- `claude auth login` is an interactive CLI flow (opens browser) — not directly callable from the web
- Claude CLI reads credentials from `~/.claude/.credentials.json` OR `ANTHROPIC_API_KEY` env var
- For per-user credentials: need a `User` model in Prisma, NextAuth.js for Google OAuth, and encrypted credential storage per user
- The executor must pass per-user credentials when spawning `claude` (write temp credentials file or set env var)

## Auto-Commit Rule

After any file change: `git add <files> && git commit -m "<type>: <desc>" && git push origin feature/initial-implementation`
