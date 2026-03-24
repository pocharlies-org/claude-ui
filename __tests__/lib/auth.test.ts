import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateBearerToken, unauthorizedResponse, getAuthUser, validateRequest } from '@/lib/auth'

vi.mock('@/lib/auth-config', () => ({
  auth: vi.fn().mockResolvedValue(null),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

describe('validateBearerToken', () => {
  beforeEach(() => {
    vi.stubEnv('CLAUDE_UI_SECRET', 'test-secret')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('returns true for correct token', () => {
    expect(validateBearerToken('Bearer test-secret')).toBe(true)
  })

  it('returns false for wrong token', () => {
    expect(validateBearerToken('Bearer wrong')).toBe(false)
  })

  it('returns false for missing Authorization header', () => {
    expect(validateBearerToken(undefined)).toBe(false)
  })

  it('returns false for non-Bearer scheme', () => {
    expect(validateBearerToken('Basic test-secret')).toBe(false)
  })

  it('returns false and warns when CLAUDE_UI_SECRET is unset', () => {
    vi.unstubAllEnvs() // clear the beforeEach stub
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    expect(validateBearerToken('Bearer anything')).toBe(false)
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('CLAUDE_UI_SECRET is not set')
    )
    stderrSpy.mockRestore()
  })
})

describe('unauthorizedResponse', () => {
  it('returns 401 with JSON body', async () => {
    const res = unauthorizedResponse()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })
})

describe('getAuthUser', () => {
  it('returns null when no session', async () => {
    const result = await getAuthUser()
    expect(result).toBeNull()
  })

  it('returns user when session exists', async () => {
    const { auth } = await import('@/lib/auth-config')
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: 'user1',
        email: 'test@cloudblue.com',
        name: 'Test User',
        isAdmin: true,
        hasCredentials: false,
      },
      expires: new Date().toISOString(),
    } as never)
    const result = await getAuthUser()
    expect(result).toEqual({
      id: 'user1',
      email: 'test@cloudblue.com',
      name: 'Test User',
      isAdmin: true,
      hasCredentials: false,
    })
  })
})

describe('validateRequest', () => {
  beforeEach(() => {
    vi.stubEnv('CLAUDE_UI_SECRET', 'test-secret')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('returns null for no auth at all', async () => {
    const result = await validateRequest(undefined)
    expect(result).toBeNull()
  })

  it('returns bearer type for valid bearer token', async () => {
    const result = await validateRequest('Bearer test-secret')
    expect(result).toEqual({ type: 'bearer' })
  })

  it('returns user type when NextAuth session is present', async () => {
    const { auth } = await import('@/lib/auth-config')
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: 'user1',
        email: 'test@cloudblue.com',
        name: 'Test',
        isAdmin: false,
        hasCredentials: true,
      },
      expires: new Date().toISOString(),
    } as never)
    const result = await validateRequest('Bearer wrong-token')
    expect(result).toEqual({
      type: 'user',
      user: {
        id: 'user1',
        email: 'test@cloudblue.com',
        name: 'Test',
        isAdmin: false,
        hasCredentials: true,
      },
    })
  })
})
