import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, unauthorizedResponse } from '@/lib/auth'
import { assertSessionOwnership } from '@/lib/ownership'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const CreateTokenSchema = z.object({
  name: z.string().min(1),
  sessionId: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  // User-scoped: only show tokens for sessions the user owns
  let tokens
  if (authResult.type === 'user' && !authResult.user.isAdmin) {
    const userSessionIds = await db.agentSession.findMany({
      where: { createdBy: authResult.user.id },
      select: { id: true },
    })
    tokens = await db.webhookToken.findMany({
      where: { sessionId: { in: userSessionIds.map(s => s.id) } },
      orderBy: { createdAt: 'desc' },
    })
  } else {
    tokens = await db.webhookToken.findMany({ orderBy: { createdAt: 'desc' } })
  }

  return NextResponse.json(tokens.map(({ tokenHash: _, ...t }) => t))
}

export async function POST(req: NextRequest) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  const body = await req.json().catch(() => null)
  const parsed = CreateTokenSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verify ownership of the target session
  if (authResult.type === 'user') {
    try {
      await assertSessionOwnership(parsed.data.sessionId, authResult.user.id, authResult.user.isAdmin)
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(rawToken, 10)
  const token = await db.webhookToken.create({
    data: { name: parsed.data.name, sessionId: parsed.data.sessionId, tokenHash },
  })
  // Return raw token ONCE — not stored in plain text
  return NextResponse.json({ id: token.id, name: token.name, token: rawToken, createdAt: token.createdAt }, { status: 201 })
}
