import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/sessions/route'
import { GET as GET_ONE, PUT, DELETE } from '@/app/api/sessions/[id]/route'
import { NextRequest } from 'next/server'

const SESSION = {
  id: 'sess1', name: 'test', soul: 'be helpful', skills: '[]',
  rules: '["no bad"]', mcpServers: '["jenkins"]', model: 'claude-opus-4-6',
  maxTurns: null, maxConcurrent: 1, description: null,
  createdAt: new Date(), updatedAt: new Date(),
}

vi.mock('@/lib/db', () => ({
  db: {
    session: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

const makeReq = (method: string, url: string, body?: unknown, token = 'test-secret') =>
  new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe('GET /api/sessions', () => {
  beforeEach(() => vi.stubEnv('CLAUDE_UI_SECRET', 'test-secret'))

  it('returns 401 without token', async () => {
    const res = await GET(new NextRequest('http://localhost/api/sessions'))
    expect(res.status).toBe(401)
  })

  it('returns empty array when no sessions', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/sessions'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('POST /api/sessions', () => {
  beforeEach(() => vi.stubEnv('CLAUDE_UI_SECRET', 'test-secret'))

  it('returns 400 for missing required fields', async () => {
    const res = await POST(makeReq('POST', 'http://localhost/api/sessions', { name: 'test' }))
    expect(res.status).toBe(400)
  })

  it('creates session with valid data — returns parsed arrays', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.session.create).mockResolvedValueOnce(SESSION)
    const res = await POST(makeReq('POST', 'http://localhost/api/sessions', { name: 'test', soul: 'be helpful' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('test')
    expect(Array.isArray(body.skills)).toBe(true)
    expect(Array.isArray(body.rules)).toBe(true)
    expect(Array.isArray(body.mcpServers)).toBe(true)
    expect(body.rules).toEqual(['no bad'])
    expect(body.mcpServers).toEqual(['jenkins'])
  })
})

describe('GET /api/sessions/:id', () => {
  beforeEach(() => vi.stubEnv('CLAUDE_UI_SECRET', 'test-secret'))

  it('returns 404 for unknown id', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.session.findUnique).mockResolvedValueOnce(null)
    const res = await GET_ONE(makeReq('GET', 'http://localhost/api/sessions/nope'), params('nope'))
    expect(res.status).toBe(404)
  })

  it('returns session with parsed arrays', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.session.findUnique).mockResolvedValueOnce(SESSION)
    const res = await GET_ONE(makeReq('GET', 'http://localhost/api/sessions/sess1'), params('sess1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.rules)).toBe(true)
    expect(Array.isArray(body.mcpServers)).toBe(true)
  })
})

describe('PUT /api/sessions/:id', () => {
  beforeEach(() => vi.stubEnv('CLAUDE_UI_SECRET', 'test-secret'))

  it('returns 404 for unknown id', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.session.update).mockRejectedValueOnce(new Error('not found'))
    const res = await PUT(makeReq('PUT', 'http://localhost/api/sessions/x', { name: 'new' }), params('x'))
    expect(res.status).toBe(404)
  })

  it('updates session and returns parsed arrays', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.session.update).mockResolvedValueOnce({ ...SESSION, name: 'updated' })
    const res = await PUT(makeReq('PUT', 'http://localhost/api/sessions/sess1', { name: 'updated' }), params('sess1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('updated')
    expect(Array.isArray(body.mcpServers)).toBe(true)
  })
})

describe('DELETE /api/sessions/:id', () => {
  beforeEach(() => vi.stubEnv('CLAUDE_UI_SECRET', 'test-secret'))

  it('returns 204 on success', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.session.delete).mockResolvedValueOnce(SESSION)
    const res = await DELETE(makeReq('DELETE', 'http://localhost/api/sessions/sess1'), params('sess1'))
    expect(res.status).toBe(204)
  })
})
