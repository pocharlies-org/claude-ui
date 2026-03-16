import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) {
    return unauthorizedResponse()
  }
  const { id } = await params
  const execution = await db.execution.findUnique({ where: { id } })
  if (!execution) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(execution)
}
