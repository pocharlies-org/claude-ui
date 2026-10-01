# ARCHITECTURE — claude-ui

Plataforma de orquestación de agentes Claude: interfaz web más servidor MCP para ejecutar sesiones del CLI `claude`, disparadas a mano, por webhook, por cron o por OpenClaw/moltbot. Nació en el entorno de CloudBlue (clúster `infra-virtuozzo`, namespace `devopsai`); no es del runtime actual de la compañía. Su tronco real es la rama `feature/initial-implementation` (no tiene `main`).

## Clientes y versiones

- Navegador contra Next.js (puerto 3000): `/sessions`, `/executions` (salida en vivo por SSE con xterm.js), `/crons`, `/webhooks`, `/settings`.
- Servidor MCP (puerto 3100, transporte SSE): herramientas `execute_session`, `list_sessions` y `get_execution`; OpenClaw/moltbot llega por `mcp-proxy` (puerto 3007, `supergateway`).
- Máquinas: webhooks y scripts con `Authorization: Bearer $CLAUDE_UI_SECRET`.
- Versión: la de `package.json` (no verificada). Sin otros clientes.

## Dependencias (en ambos sentidos)

- Depende de: el CLI `claude` instalado globalmente en la imagen (OAuth Teams/Pro desde `~/.claude/.credentials.json`, también por usuario, cifrado AES-256-GCM), LiteLLM (`/api/litellm/mcp-servers`, `LITELLM_URL`), SQLite en `/data/db.sqlite` y Google OAuth (NextAuth, restringido a `@cloudblue.com`).
- Dependen de él: OpenClaw/moltbot (MCP). Registro `a8n-docker.repo.com.int.zone/devopsai/claude-ui` y el chart Helm `charts/claude-ui/`, que está en el tronco.
- Las URLs y registros son del entorno CloudBlue, no de la infraestructura de la compañía.

## Stack

Next.js 16 (App Router, `output: standalone`), TypeScript estricto, Prisma 7 con SQLite (`@prisma/adapter-libsql`, `@libsql/client`), shadcn/ui v4 y Tailwind, xterm.js, node-cron 4, `@modelcontextprotocol/sdk`, pino, NextAuth 5 y Vitest (12 ficheros de test).

## Componentes compartidos

- `src/lib/executor.ts`: único sitio que lanza el CLI `claude`, difunde por SSE y recupera huérfanas.
- `src/lib/auth.ts` (`validateRequest`): auth dual (sesión NextAuth o bearer); todas las rutas API pasan por ella.
- `src/lib/db.ts`: cliente Prisma/libsql único.
- `src/mcp/` y `src/cron/`: servidor MCP y planificador; los arranca `src/instrumentation.ts` al iniciar Next.

## Cómo se construye

Estructura `src/app/api/*` (rutas), `src/lib`, `src/mcp`, `src/cron` y `prisma/schema.prisma` (Session, Execution, CronJob, WebhookToken, User). Prisma 7 con SQLite: `DATABASE_URL` va en `prisma.config.ts` y en `src/lib/db.ts`, sin `url` en el bloque datasource; `PrismaLibSql({ url })`. Visibilidad por `createdBy`; los admins ven todo. `CLAUDE.md` pide auto-commit y push a `feature/initial-implementation`: en la compañía rige rama + PR.

## Tests

`npm test` (Vitest; `vitest.config.ts` debe excluir `.next`, si no recoge tests de `.next/standalone` y da 30 fallos), `npm run test:coverage` (umbral 80 %) y `npm run lint`. Pendiente según `CLAUDE.md`: e2e del flujo de auth, límite de tasa en la subida de credenciales y rotación de credenciales.

## CI/CD y despliegue

`bitbucket-pipelines.yml` (CI/CD de Bitbucket), `Dockerfile` multi-etapa (builder → runner con el CLI de `claude`; copia `@libsql` a mano; ejecuta `npx prisma migrate deploy` antes de `node server.js`) y el chart Helm `charts/claude-ui/` con el Secret `claude-ui` (`CLAUDE_UI_SECRET`, `LITELLM_API_KEY`, `credentials.json`). En GitHub solo existen los workflows estándar `duplicados.yml` y `pr-review.yml`: no hay build ni despliegue de GitHub Actions, y no hay ArgoCD. No sigue el estándar de despliegue de la compañía.

## Decisiones y trampas

- Los eventos SSE aceptan `?token=` porque `EventSource` no puede poner cabeceras.
- Las credenciales de Claude por usuario se descifran a un `HOME` temporal que se borra al terminar la ejecución.
- El `README.md` es el de `create-next-app` y no describe el proyecto: la fuente es `CLAUDE.md`.
- Tronco `feature/initial-implementation` y pipeline de Bitbucket: es código ajeno al clúster actual; candidato a archivar o migrar (ver C5 de SC-1425).
