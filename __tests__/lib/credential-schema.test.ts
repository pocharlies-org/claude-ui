import { describe, it, expect } from 'vitest'
import { validateCredentialsJson } from '@/lib/credential-schema'

describe('validateCredentialsJson', () => {
  it('accepts a valid JSON object', () => {
    const result = validateCredentialsJson('{"token": "abc"}')
    expect(result.valid).toBe(true)
  })

  it('accepts an empty object', () => {
    const result = validateCredentialsJson('{}')
    expect(result.valid).toBe(true)
  })

  it('rejects invalid JSON', () => {
    const result = validateCredentialsJson('not json')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid JSON')
  })

  it('rejects a JSON array', () => {
    const result = validateCredentialsJson('[]')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('JSON object')
  })

  it('rejects a JSON string', () => {
    const result = validateCredentialsJson('"just a string"')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('JSON object')
  })

  it('rejects null', () => {
    const result = validateCredentialsJson('null')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('JSON object')
  })
})
