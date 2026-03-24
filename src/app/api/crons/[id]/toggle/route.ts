import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import { registerCronJob, unregisterCronJob } from '@/cron/scheduler'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  const { id } = await params
  const cron = await db.cronJob.findUnique({ where: { id }, include: { session: { select: { createdBy: true } } } })
  if (!cron) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (authResult.type === 'user' && !authResult.user.isAdmin) {
    if (cron.session.createdBy !== null && cron.session.createdBy !== authResult.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const updated = await db.cronJob.update({ where: { id }, data: { enabled: !cron.enabled } })
  if (updated.enabled) registerCronJob(updated)
  else unregisterCronJob(id)
  return NextResponse.json(updated)
}
