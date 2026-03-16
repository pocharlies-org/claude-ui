import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  if (!validateBearerToken(req.headers.get('authorization') ?? undefined)) {
    return unauthorizedResponse()
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '20')))
  const sessionId = searchParams.get('sessionId') ?? undefined
  const status = searchParams.get('status') ?? undefined

  const where = {
    ...(sessionId ? { sessionId } : {}),
    ...(status ? { status } : {}),
  }

  const [executions, total] = await Promise.all([
    db.execution.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, sessionId: true, triggeredBy: true, triggerSource: true,
        status: true, exitCode: true, startedAt: true, completedAt: true, durationMs: true,
        prompt: true,
      },
    }),
    db.execution.count({ where }),
  ])

  return NextResponse.json({ executions, total, page, limit })
}
