import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveCredentials } from '@/lib/credential-resolver'

const TEST_KEY = 'a'.repeat(64)

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
  },
}))

describe('resolveCredentials', () => {
  beforeEach(() => vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', TEST_KEY))
  afterEach(() => vi.unstubAllEnvs())

  it('returns null for null userId', async () => {
    expect(await resolveCredentials(null)).toBeNull()
  })

  it('returns null for undefined userId', async () => {
    expect(await resolveCredentials(undefined)).toBeNull()
  })

  it('returns null when user has no credentials', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({ encryptedCredentials: null } as never)
    expect(await resolveCredentials('user1')).toBeNull()
  })

  it('decrypts and returns credentials when present', async () => {
    const { db } = await import('@/lib/db')
    // Encrypt a test value first
    const { encryptCredentials } = await import('@/lib/crypto')
    const encrypted = encryptCredentials('{"token":"abc"}')
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({ encryptedCredentials: encrypted } as never)
    const result = await resolveCredentials('user1')
    expect(result).toBe('{"token":"abc"}')
  })
})
