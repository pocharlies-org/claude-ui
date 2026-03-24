import { db } from '@/lib/db'
import { executeSession } from '@/lib/executor'
import { logger } from '@/lib/logger'

export async function handleExecuteSession(params: {
  sessionId: string
  prompt: string
  soul?: string
  skills?: string[]
  rules?: string[]
  userId?: string
  context?: Record<string, unknown>
}) {
  const session = await db.agentSession.findUnique({ where: { id: params.sessionId } })
  if (!session) throw new Error(`Session not found: ${params.sessionId}`)

  const running = await db.execution.count({ where: { sessionId: params.sessionId, status: 'running' } })
  if (running >= session.maxConcurrent) throw new Error('Concurrent execution limit reached')

  const execution = await db.execution.create({
    data: {
      sessionId: params.sessionId,
      triggeredBy: 'mcp',
      triggerSource: 'openclaw',
      prompt: params.prompt,
      soulOverride: params.soul ?? null,
      skillsOverride: params.skills ? JSON.stringify(params.skills) : null,
      rulesOverride: params.rules ? JSON.stringify(params.rules) : null,
      status: 'running',
    },
  })

  logger.info({ executionId: execution.id, sessionId: params.sessionId }, 'MCP execution triggered')

  executeSession({
    executionId: execution.id,
    sessionId: params.sessionId,
    prompt: params.prompt,
    soul: session.soul,
    skills: session.skills,
    rules: session.rules,
    mcpServers: session.mcpServers,
    model: session.model,
    maxTurns: session.maxTurns,
    soulOverride: params.soul ?? null,
    skillsOverride: params.skills ? JSON.stringify(params.skills) : null,
    rulesOverride: params.rules ? JSON.stringify(params.rules) : null,
    credentialsUserId: params.userId ?? null,
  }).catch(err => logger.error({ err }, 'MCP execution error'))

  return { executionId: execution.id, status: 'running' }
}

export async function handleListSessions() {
  const sessions = await db.agentSession.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { name: 'asc' },
  })
  return { sessions }
}

export async function handleGetExecution(params: { executionId: string }) {
  const execution = await db.execution.findUnique({ where: { id: params.executionId } })
  if (!execution) throw new Error(`Execution not found: ${params.executionId}`)
  return {
    id: execution.id,
    status: execution.status,
    output: execution.output,
    durationMs: execution.durationMs,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
  }
}
