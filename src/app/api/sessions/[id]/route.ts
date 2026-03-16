import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const parse = (s: string) => JSON.parse(s) as string[]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const { id } = await params
  const session = await db.session.findUnique({ where: { id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = SessionUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { skills, rules, mcpServers, ...rest } = parsed.data
  const updated = await db.session.update({
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
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const { id } = await params
  await db.session.delete({ where: { id } }).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
