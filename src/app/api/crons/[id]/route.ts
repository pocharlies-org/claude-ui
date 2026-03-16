import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import { registerCronJob, unregisterCronJob } from '@/cron/scheduler'
import { z } from 'zod'

const CronUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  schedule: z.string().min(1).optional(),
  timezone: z.string().optional(),
  prompt: z.string().min(1).optional(),
  soulOverride: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = CronUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const updated = await db.cronJob.update({ where: { id }, data: parsed.data }).catch(() => null)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Re-register scheduler with updated config
  unregisterCronJob(id)
  if (updated.enabled) registerCronJob(updated)
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const { id } = await params
  unregisterCronJob(id)
  await db.cronJob.delete({ where: { id } }).catch(() => null)
  return new NextResponse(null, { status: 204 })
}
