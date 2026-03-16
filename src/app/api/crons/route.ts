import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { registerCronJob } from '@/cron/scheduler'

const CronCreateSchema = z.object({
  name: z.string().min(1),
  sessionId: z.string().min(1),
  schedule: z.string().min(1),
  timezone: z.string().default('UTC'),
  prompt: z.string().min(1),
  soulOverride: z.string().optional(),
  enabled: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const crons = await db.cronJob.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(crons)
}

export async function POST(req: NextRequest) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) return unauthorizedResponse()
  const body = await req.json().catch(() => null)
  const parsed = CronCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const cron = await db.cronJob.create({ data: parsed.data })
  if (cron.enabled) registerCronJob(cron)
  return NextResponse.json(cron, { status: 201 })
}
