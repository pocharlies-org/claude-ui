import { describe, it, expect, vi } from 'vitest'
import { userScopeFilter, assertSessionOwnership, userExecutionFilter } from '@/lib/ownership'

vi.mock('@/lib/db', () => ({
  db: {
    agentSession: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

describe('userScopeFilter', () => {
  it('returns empty object for admin', () => {
    expect(userScopeFilter('user1', true)).toEqual({})
  })

  it('returns createdBy filter for non-admin', () => {
    expect(userScopeFilter('user1', false)).toEqual({ createdBy: 'user1' })
  })
})

describe('assertSessionOwnership', () => {
  it('throws "Session not found" for missing session', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.agentSession.findUnique).mockResolvedValueOnce(null)
    await expect(assertSessionOwnership('sess1', 'user1', false)).rejects.toThrow('Session not found')
  })

  it('allows admin to access any session', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.agentSession.findUnique).mockResolvedValueOnce({ createdBy: 'other-user' } as never)
    await expect(assertSessionOwnership('sess1', 'admin1', true)).resolves.toBeUndefined()
  })

  it('allows owner to access their session', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.agentSession.findUnique).mockResolvedValueOnce({ createdBy: 'user1' } as never)
    await expect(assertSessionOwnership('sess1', 'user1', false)).resolves.toBeUndefined()
  })

  it('allows access to unowned sessions (createdBy null)', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.agentSession.findUnique).mockResolvedValueOnce({ createdBy: null } as never)
    await expect(assertSessionOwnership('sess1', 'user1', false)).resolves.toBeUndefined()
  })

  it('throws "Forbidden" for non-owner', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.agentSession.findUnique).mockResolvedValueOnce({ createdBy: 'other-user' } as never)
    await expect(assertSessionOwnership('sess1', 'user1', false)).rejects.toThrow('Forbidden')
  })
})

describe('userExecutionFilter', () => {
  it('returns empty object for admin', async () => {
    const result = await userExecutionFilter('admin1', true)
    expect(result).toEqual({})
  })

  it('returns session ID filter for non-admin', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.agentSession.findMany).mockResolvedValueOnce([
      { id: 'sess1' } as never,
      { id: 'sess2' } as never,
    ])
    const result = await userExecutionFilter('user1', false)
    expect(result).toEqual({ sessionId: { in: ['sess1', 'sess2'] } })
  })
})
