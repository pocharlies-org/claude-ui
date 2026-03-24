import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, unauthorizedResponse } from '@/lib/auth'
import { assertSessionOwnership } from '@/lib/ownership'
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
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  // User-scoped: only show crons for sessions the user owns
  let crons
  if (authResult.type === 'user' && !authResult.user.isAdmin) {
    const userSessionIds = await db.agentSession.findMany({
      where: { createdBy: authResult.user.id },
      select: { id: true },
    })
    crons = await db.cronJob.findMany({
      where: { sessionId: { in: userSessionIds.map(s => s.id) } },
      orderBy: { createdAt: 'desc' },
    })
  } else {
    crons = await db.cronJob.findMany({ orderBy: { createdAt: 'desc' } })
  }

  return NextResponse.json(crons)
}

export async function POST(req: NextRequest) {
  const authResult = await validateRequest(req.headers.get('authorization') ?? undefined)
  if (!authResult) return unauthorizedResponse()

  const body = await req.json().catch(() => null)
  const parsed = CronCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Verify ownership of the target session
  if (authResult.type === 'user') {
    try {
      await assertSessionOwnership(parsed.data.sessionId, authResult.user.id, authResult.user.isAdmin)
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const createdBy = authResult.type === 'user' ? authResult.user.id : null
  const cron = await db.cronJob.create({ data: { ...parsed.data, createdBy } })
  if (cron.enabled) registerCronJob(cron)
  return NextResponse.json(cron, { status: 201 })
}
