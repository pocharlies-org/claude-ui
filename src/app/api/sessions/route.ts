import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, unauthorizedResponse } from '@/lib/auth'
import { userScopeFilter } from '@/lib/ownership'
import { db } from '@/lib/db'
import { z } from 'zod'

const SessionCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  soul: z.string().min(1),
  skills: z.array(z.string()).default([]),
  rules: z.array(z.string()).default([]),
  mcpServers: z.array(z.string()).default([]),
  model: z.string().default('claude-opus-4-6'),
  maxTurns: z.number().int().positive().optional(),
  maxConcurrent: z.number().int().min(1).default(1),
})

export async function GET(req: NextRequest) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  const where = authResult.type === 'user'
    ? userScopeFilter(authResult.user.id, authResult.user.isAdmin)
    : {}

  const sessions = await db.agentSession.findMany({ where, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(sessions.map(s => ({
    ...s,
    skills: JSON.parse(s.skills),
    rules: JSON.parse(s.rules),
    mcpServers: JSON.parse(s.mcpServers),
  })))
}

export async function POST(req: NextRequest) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  const body = await req.json().catch(() => null)
  const parsed = SessionCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { skills, rules, mcpServers, ...rest } = parsed.data
  const createdBy = authResult.type === 'user' ? authResult.user.id : null

  const session = await db.agentSession.create({
    data: {
      ...rest,
      skills: JSON.stringify(skills),
      rules: JSON.stringify(rules),
      mcpServers: JSON.stringify(mcpServers),
      createdBy,
    },
  })
  return NextResponse.json({
    ...session,
    skills: JSON.parse(session.skills),
    rules: JSON.parse(session.rules),
    mcpServers: JSON.parse(session.mcpServers),
  }, { status: 201 })
}
