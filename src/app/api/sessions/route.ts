import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'
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
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const sessions = await db.session.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(sessions.map(s => ({
    ...s,
    skills: JSON.parse(s.skills),
    rules: JSON.parse(s.rules),
    mcpServers: JSON.parse(s.mcpServers),
  })))
}

export async function POST(req: NextRequest) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const body = await req.json().catch(() => null)
  const parsed = SessionCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { skills, rules, mcpServers, ...rest } = parsed.data
  const session = await db.session.create({
    data: { ...rest, skills: JSON.stringify(skills), rules: JSON.stringify(rules), mcpServers: JSON.stringify(mcpServers) },
  })
  return NextResponse.json({
    ...session,
    skills: JSON.parse(session.skills),
    rules: JSON.parse(session.rules),
    mcpServers: JSON.parse(session.mcpServers),
  }, { status: 201 })
}
