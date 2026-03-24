import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, unauthorizedResponse } from '@/lib/auth'
import { assertSessionOwnership } from '@/lib/ownership'
import { db } from '@/lib/db'
import { z } from 'zod'

const parse = (s: string) => JSON.parse(s) as string[]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  const { id } = await params
  const session = await db.agentSession.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (authResult.type === 'user' && !authResult.user.isAdmin && session.createdBy !== null && session.createdBy !== authResult.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    ...session,
    skills: parse(session.skills),
    rules: parse(session.rules),
    mcpServers: parse(session.mcpServers),
  })
}

const SessionUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  soul: z.string().min(1).optional(),
  skills: z.array(z.string()).optional(),
  rules: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
  model: z.string().optional(),
  maxTurns: z.number().int().positive().nullable().optional(),
  maxConcurrent: z.number().int().min(1).optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  const { id } = await params

  if (authResult.type === 'user') {
    try {
      await assertSessionOwnership(id, authResult.user.id, authResult.user.isAdmin)
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await req.json().catch(() => null)
  const parsed = SessionUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { skills, rules, mcpServers, ...rest } = parsed.data
  const updated = await db.agentSession.update({
    where: { id },
    data: {
      ...rest,
      ...(skills !== undefined ? { skills: JSON.stringify(skills) } : {}),
      ...(rules !== undefined ? { rules: JSON.stringify(rules) } : {}),
      ...(mcpServers !== undefined ? { mcpServers: JSON.stringify(mcpServers) } : {}),
    },
  }).catch(() => null)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...updated,
    skills: JSON.parse(updated.skills),
    rules: JSON.parse(updated.rules),
    mcpServers: JSON.parse(updated.mcpServers),
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  const { id } = await params

  if (authResult.type === 'user') {
    try {
      await assertSessionOwnership(id, authResult.user.id, authResult.user.isAdmin)
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  await db.agentSession.delete({ where: { id } }).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
