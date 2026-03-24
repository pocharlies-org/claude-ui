import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET, POST, DELETE } from '@/app/api/user/credentials/route'
import { NextRequest } from 'next/server'

const TEST_KEY = 'a'.repeat(64)

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-config', () => ({
  auth: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

const mockAuthUser = async () => {
  const { auth } = await import('@/lib/auth-config')
  vi.mocked(auth).mockResolvedValue({
    user: { id: 'user1', email: 'test@cloudblue.com', name: 'Test', isAdmin: false, hasCredentials: false },
    expires: new Date().toISOString(),
  } as never)
}

describe('GET /api/user/credentials', () => {
  beforeEach(() => vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', TEST_KEY))
  afterEach(() => vi.unstubAllEnvs())

  it('returns 401 without auth', async () => {
    const { auth } = await import('@/lib/auth-config')
    vi.mocked(auth).mockResolvedValueOnce(null as never)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns linked: false when no credentials', async () => {
    await mockAuthUser()
    const { db } = await import('@/lib/db')
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({ credentialsLinkedAt: null } as never)
    const res = await GET()
    const body = await res.json()
    expect(body.linked).toBe(false)
    expect(body.linkedAt).toBeNull()
  })

  it('returns linked: true with date', async () => {
    await mockAuthUser()
    const date = new Date('2026-03-24T12:00:00Z')
    const { db } = await import('@/lib/db')
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({ credentialsLinkedAt: date } as never)
    const res = await GET()
    const body = await res.json()
    expect(body.linked).toBe(true)
    expect(body.linkedAt).toBe(date.toISOString())
  })
})

describe('POST /api/user/credentials', () => {
  beforeEach(() => vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', TEST_KEY))
  afterEach(() => vi.unstubAllEnvs())

  it('returns 401 without auth', async () => {
    const { auth } = await import('@/lib/auth-config')
    vi.mocked(auth).mockResolvedValueOnce(null as never)
    const req = new NextRequest('http://localhost/api/user/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: '{}' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('accepts valid credentials JSON body and encrypts', async () => {
    await mockAuthUser()
    const { db } = await import('@/lib/db')
    vi.mocked(db.user.update).mockResolvedValueOnce({} as never)
    const req = new NextRequest('http://localhost/api/user/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: '{"token":"abc"}' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.linkedAt).toBeDefined()
    // Verify db.user.update was called with encrypted data
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user1' },
        data: expect.objectContaining({
          encryptedCredentials: expect.any(String),
          credentialsLinkedAt: expect.any(Date),
        }),
      })
    )
  })

  it('rejects invalid JSON', async () => {
    await mockAuthUser()
    const req = new NextRequest('http://localhost/api/user/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: 'not-json' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid JSON')
  })
})

describe('DELETE /api/user/credentials', () => {
  it('clears credentials', async () => {
    await mockAuthUser()
    const { db } = await import('@/lib/db')
    vi.mocked(db.user.update).mockResolvedValueOnce({} as never)
    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { encryptedCredentials: null, credentialsLinkedAt: null },
    })
  })
})
