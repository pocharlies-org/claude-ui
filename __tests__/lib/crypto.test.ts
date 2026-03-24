import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encryptCredentials, decryptCredentials } from '@/lib/crypto'

// 64-char hex string = 32 bytes for AES-256
const TEST_KEY = 'a'.repeat(64)

describe('crypto', () => {
  beforeEach(() => {
    vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', TEST_KEY)
  })

  afterEach(() => vi.unstubAllEnvs())

  it('encrypts and decrypts roundtrip', () => {
    const plaintext = JSON.stringify({ oauthToken: 'test-token', refreshToken: 'refresh' })
    const encrypted = encryptCredentials(plaintext)
    const decrypted = decryptCredentials(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input'
    const a = encryptCredentials(plaintext)
    const b = encryptCredentials(plaintext)
    expect(a).not.toBe(b)
    // But both decrypt to the same value
    expect(decryptCredentials(a)).toBe(plaintext)
    expect(decryptCredentials(b)).toBe(plaintext)
  })

  it('throws on missing encryption key', () => {
    vi.unstubAllEnvs()
    expect(() => encryptCredentials('test')).toThrow('CREDENTIALS_ENCRYPTION_KEY')
  })

  it('throws on wrong-length encryption key', () => {
    vi.stubEnv('CREDENTIALS_ENCRYPTION_KEY', 'too-short')
    expect(() => encryptCredentials('test')).toThrow('64-char hex string')
  })

  it('detects tampered ciphertext', () => {
    const encrypted = encryptCredentials('secret')
    const parsed = JSON.parse(encrypted)
    // Flip a byte in the ciphertext
    const buf = Buffer.from(parsed.ciphertext, 'base64')
    buf[0] = buf[0] ^ 0xff
    parsed.ciphertext = buf.toString('base64')
    expect(() => decryptCredentials(JSON.stringify(parsed))).toThrow()
  })
})
