import { describe, it, expect } from 'vitest'
import { logger } from '@/lib/logger'

describe('logger', () => {
  it('is a pino logger instance', () => {
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
  })
})
