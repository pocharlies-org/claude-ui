import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  const { id } = await params
  const execution = await db.execution.findUnique({
    where: { id },
    include: { session: { select: { createdBy: true } } },
  })
  if (!execution) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Ownership check: user must own the session that produced this execution
  if (authResult.type === 'user' && !authResult.user.isAdmin) {
    if (execution.session.createdBy !== null && execution.session.createdBy !== authResult.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { session: _, ...rest } = execution
  return NextResponse.json(rest)
}
