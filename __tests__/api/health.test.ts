import { describe, it, expect, vi } from 'vitest'
import { GET } from '@/app/api/health/route'

vi.mock('@/lib/db', () => ({
  db: { $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]) },
}))

describe('GET /api/health', () => {
  it('returns 200 with ok status when DB is reachable', async () => {
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'ok', db: 'ok' })
  })

  it('returns 503 when DB is unreachable', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.$queryRaw).mockRejectedValueOnce(new Error('DB down'))
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('error')
  })
})
