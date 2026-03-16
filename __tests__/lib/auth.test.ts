import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateBearerToken, unauthorizedResponse } from '@/lib/auth'

describe('validateBearerToken', () => {
  beforeEach(() => {
    vi.stubEnv('CLAUDE_UI_SECRET', 'test-secret')
  })

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

  it('unauthorizedResponse returns 401 with JSON body', async () => {
    const res = unauthorizedResponse()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })
})
