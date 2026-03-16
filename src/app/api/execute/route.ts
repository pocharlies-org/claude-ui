import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import { executeSession } from '@/lib/executor'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const ExecuteSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(1),
  soul: z.string().optional(),
  skills: z.array(z.string()).optional(),
  rules: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) {
    return unauthorizedResponse()
  }

  const body = await req.json().catch(() => null)
  const parsed = ExecuteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { sessionId, prompt, soul, skills, rules } = parsed.data
  const session = await db.session.findUnique({ where: { id: sessionId } })
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Enforce concurrent execution limit
  const running = await db.execution.count({ where: { sessionId, status: 'running' } })
  if (running >= session.maxConcurrent) {
    return NextResponse.json({ error: 'Concurrent execution limit reached' }, { status: 429 })
  }

  const execution = await db.execution.create({
    data: {
      sessionId,
      triggeredBy: 'manual',
      prompt,
      soulOverride: soul ?? null,
      skillsOverride: skills ? JSON.stringify(skills) : null,
      rulesOverride: rules ? JSON.stringify(rules) : null,
      status: 'running',
    },
  })

  logger.info({ executionId: execution.id, sessionId }, 'Manual execution triggered')

  // Fire and forget — do not await
  executeSession({
    executionId: execution.id,
    sessionId,
    prompt,
    soul: session.soul,
    skills: session.skills,
    rules: session.rules,
    mcpServers: session.mcpServers,
    model: session.model,
    maxTurns: session.maxTurns,
    soulOverride: soul ?? null,
    skillsOverride: skills ? JSON.stringify(skills) : null,
    rulesOverride: rules ? JSON.stringify(rules) : null,
  }).catch(err => logger.error({ err, executionId: execution.id }, 'Execution error'))

  return NextResponse.json({ executionId: execution.id, status: 'running' }, { status: 202 })
}
