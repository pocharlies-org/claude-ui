import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const { id } = await params
  await db.webhookToken.delete({ where: { id } }).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
