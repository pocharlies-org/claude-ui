import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/execute/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: {
    agentSession: { findUnique: vi.fn() },
    execution: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/executor', () => ({ executeSession: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/lib/auth-config', () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

const AGENT_SESSION = {
  id: 'sess1', name: 'test', soul: 'soul', skills: '[]', rules: '[]',
  mcpServers: '[]', model: 'claude-opus-4-6', maxTurns: null, maxConcurrent: 1,
  description: null, createdBy: null, createdAt: new Date(), updatedAt: new Date(),
}

const makeRequest = (body: unknown, token = 'test-secret') =>
  new NextRequest('http://localhost/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })

describe('POST /api/execute', () => {
  beforeEach(() => {
    vi.stubEnv('CLAUDE_UI_SECRET', 'test-secret')
    vi.clearAllMocks()
  })

  it('returns 401 for missing token', async () => {
    const req = new NextRequest('http://localhost/api/execute', { method: 'POST', body: '{}' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown session', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.agentSession.findUnique).mockResolvedValueOnce(null)
    const res = await POST(makeRequest({ sessionId: 'unknown', prompt: 'hello' }))
    expect(res.status).toBe(404)
  })

  it('returns 202 and executionId for valid request', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.agentSession.findUnique).mockResolvedValueOnce(AGENT_SESSION)
    vi.mocked(db.execution.create).mockResolvedValueOnce({ id: 'exec1', status: 'running' } as never)
    const res = await POST(makeRequest({ sessionId: 'sess1', prompt: 'do something' }))
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.executionId).toBe('exec1')
    expect(body.status).toBe('running')
  })

  it('returns 429 when concurrent limit reached', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.agentSession.findUnique).mockResolvedValueOnce(AGENT_SESSION)
    vi.mocked(db.execution.count).mockResolvedValueOnce(1)
    const res = await POST(makeRequest({ sessionId: 'sess1', prompt: 'do something' }))
    expect(res.status).toBe(429)
  })
})
