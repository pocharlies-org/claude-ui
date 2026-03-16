import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'

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
