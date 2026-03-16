import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const CreateTokenSchema = z.object({
  name: z.string().min(1),
  sessionId: z.string().min(1),
})

export async function GET(req: NextRequest) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const tokens = await db.webhookToken.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(tokens.map(({ tokenHash: _, ...t }) => t))
}

export async function POST(req: NextRequest) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const body = await req.json().catch(() => null)
  const parsed = CreateTokenSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(rawToken, 10)
  const token = await db.webhookToken.create({
    data: { name: parsed.data.name, sessionId: parsed.data.sessionId, tokenHash },
  })
  // Return raw token ONCE — not stored in plain text
  return NextResponse.json({ id: token.id, name: token.name, token: rawToken, createdAt: token.createdAt }, { status: 201 })
}
