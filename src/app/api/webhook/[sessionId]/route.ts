import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { executeSession } from '@/lib/executor'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const TriggerSchema = z.object({
  prompt: z.string().min(1),
  soul: z.string().optional(),
  skills: z.array(z.string()).optional(),
  rules: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find valid webhook token for this session
  const tokens = await db.webhookToken.findMany({ where: { sessionId } })
  const validToken = await Promise.all(tokens.map(t => bcrypt.compare(token, t.tokenHash)))
    .then((results) => tokens.find((_, i) => results[i]))
  if (!validToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Update lastUsedAt
  await db.webhookToken.update({ where: { id: validToken.id }, data: { lastUsedAt: new Date() } })

  const session = await db.session.findUnique({ where: { id: sessionId } })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = TriggerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { prompt, soul, skills, rules } = parsed.data
  const running = await db.execution.count({ where: { sessionId, status: 'running' } })
  if (running >= session.maxConcurrent) return NextResponse.json({ error: 'Concurrent limit reached' }, { status: 429 })

  const execution = await db.execution.create({
    data: {
      sessionId,
      triggeredBy: 'webhook',
      triggerSource: validToken.name,
      prompt,
      soulOverride: soul ?? null,
      skillsOverride: skills ? JSON.stringify(skills) : null,
      rulesOverride: rules ? JSON.stringify(rules) : null,
      status: 'running',
    },
  })

  logger.info({ executionId: execution.id, sessionId, source: validToken.name }, 'Webhook execution triggered')

  executeSession({
    executionId: execution.id, sessionId, prompt,
    soul: session.soul, skills: session.skills, rules: session.rules,
    mcpServers: session.mcpServers, model: session.model, maxTurns: session.maxTurns,
    soulOverride: soul ?? null,
    skillsOverride: skills ? JSON.stringify(skills) : null,
    rulesOverride: rules ? JSON.stringify(rules) : null,
  }).catch(err => logger.error({ err }, 'Webhook execution error'))

  return NextResponse.json({ executionId: execution.id, status: 'running' }, { status: 202 })
}
