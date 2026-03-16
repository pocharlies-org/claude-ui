import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import { registerCronJob, unregisterCronJob } from '@/cron/scheduler'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const { id } = await params
  const cron = await db.cronJob.findUnique({ where: { id } })
  if (!cron) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated = await db.cronJob.update({ where: { id }, data: { enabled: !cron.enabled } })
  if (updated.enabled) registerCronJob(updated)
  else unregisterCronJob(id)
  return NextResponse.json(updated)
}
