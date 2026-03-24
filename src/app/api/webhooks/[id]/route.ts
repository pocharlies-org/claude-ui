import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  const { id } = await params

  // Ownership check: verify the token belongs to a session the user owns
  if (authResult.type === 'user' && !authResult.user.isAdmin) {
    const token = await db.webhookToken.findUnique({
      where: { id },
      include: { session: { select: { createdBy: true } } },
    })
    if (!token) return new NextResponse(null, { status: 204 })
    if (token.session.createdBy !== null && token.session.createdBy !== authResult.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  await db.webhookToken.delete({ where: { id } }).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
