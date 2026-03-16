import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/webhook/[sessionId]/route'
import { NextRequest } from 'next/server'

vi.mock('bcryptjs', () => ({ default: { compare: vi.fn() } }))
vi.mock('@/lib/db', () => ({
  db: {
    webhookToken: { findMany: vi.fn(), update: vi.fn() },
    session: { findUnique: vi.fn() },
    execution: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
  },
}))
vi.mock('@/lib/executor', () => ({ executeSession: vi.fn().mockResolvedValue(undefined) }))

const params = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) })
const makeReq = (body: unknown, token?: string) =>
  new NextRequest('http://localhost/api/webhook/sess1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

describe('POST /api/webhook/:sessionId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when no Authorization header', async () => {
    const res = await POST(makeReq({ prompt: 'do it' }), params('sess1'))
    expect(res.status).toBe(401)
  })

  it('returns 401 when token does not match any stored token', async () => {
    const { db } = await import('@/lib/db')
    const bcrypt = await import('bcryptjs')
    vi.mocked(db.webhookToken.findMany).mockResolvedValueOnce([{ id: 'tok1', tokenHash: 'hash', name: 'test', sessionId: 'sess1', createdAt: new Date(), lastUsedAt: null }])
    vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(false as never)
    const res = await POST(makeReq({ prompt: 'do it' }, 'wrong-token'), params('sess1'))
    expect(res.status).toBe(401)
  })

  it('returns 202 with valid token and creates execution', async () => {
    const { db } = await import('@/lib/db')
    const bcrypt = await import('bcryptjs')
    const tok = { id: 'tok1', tokenHash: 'hash', name: 'webhook-1', sessionId: 'sess1', createdAt: new Date(), lastUsedAt: null }
    vi.mocked(db.webhookToken.findMany).mockResolvedValueOnce([tok])
    vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true as never)
    vi.mocked(db.webhookToken.update).mockResolvedValueOnce(tok)
    vi.mocked(db.session.findUnique).mockResolvedValueOnce({
      id: 'sess1', name: 'test', soul: 'soul', skills: '[]', rules: '[]',
      mcpServers: '[]', model: 'claude-opus-4-6', maxTurns: null, maxConcurrent: 1,
      description: null, createdAt: new Date(), updatedAt: new Date(),
    })
    vi.mocked(db.execution.create).mockResolvedValueOnce({ id: 'exec1', status: 'running' } as never)
    const res = await POST(makeReq({ prompt: 'do it' }, 'valid-token'), params('sess1'))
    expect(res.status).toBe(202)
    expect((await res.json()).executionId).toBe('exec1')
  })

  it('returns 429 when concurrent limit reached', async () => {
    const { db } = await import('@/lib/db')
    const bcrypt = await import('bcryptjs')
    const tok = { id: 'tok1', tokenHash: 'hash', name: 'webhook-1', sessionId: 'sess1', createdAt: new Date(), lastUsedAt: null }
    vi.mocked(db.webhookToken.findMany).mockResolvedValueOnce([tok])
    vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true as never)
    vi.mocked(db.webhookToken.update).mockResolvedValueOnce(tok)
    vi.mocked(db.session.findUnique).mockResolvedValueOnce({
      id: 'sess1', name: 'test', soul: 'soul', skills: '[]', rules: '[]',
      mcpServers: '[]', model: 'claude-opus-4-6', maxTurns: null, maxConcurrent: 1,
      description: null, createdAt: new Date(), updatedAt: new Date(),
    })
    vi.mocked(db.execution.count).mockResolvedValueOnce(1)
    const res = await POST(makeReq({ prompt: 'do it' }, 'valid-token'), params('sess1'))
    expect(res.status).toBe(429)
  })
})
