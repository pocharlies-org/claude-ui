import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { buildSystemPrompt, buildMcpConfig } from '@/lib/executor'

describe('buildSystemPrompt', () => {
  it('uses soulOverride when provided', () => {
    const result = buildSystemPrompt({
      soul: 'base soul',
      skills: '[]',
      rules: '[]',
      soulOverride: 'override soul',
    })
    expect(result).toContain('override soul')
    expect(result).not.toContain('base soul')
  })

  it('uses session soul when no override', () => {
    const result = buildSystemPrompt({ soul: 'base soul', skills: '[]', rules: '[]' })
    expect(result).toContain('base soul')
  })

  it('appends skillsOverride to session skills', () => {
    const result = buildSystemPrompt({
      soul: 'soul',
      skills: '["skill1"]',
      rules: '[]',
      skillsOverride: '["skill2"]',
    })
    expect(result).toContain('skill1')
    expect(result).toContain('skill2')
  })

  it('appends rulesOverride to session rules', () => {
    const result = buildSystemPrompt({
      soul: 'soul',
      skills: '[]',
      rules: '["rule1"]',
      rulesOverride: '["rule2"]',
    })
    expect(result).toContain('rule1')
    expect(result).toContain('rule2')
  })
})

describe('buildMcpConfig', () => {
  it('maps each MCP server name to the LiteLLM endpoint', () => {
    vi.stubEnv('LITELLM_URL', 'http://litellm:4000')
    const config = buildMcpConfig(['jenkins', 'thanos'])
    expect(config.mcpServers['jenkins']).toEqual({
      url: 'http://litellm:4000/mcp',
      type: 'sse',
    })
    expect(config.mcpServers['thanos']).toEqual({
      url: 'http://litellm:4000/mcp',
      type: 'sse',
    })
  })

  it('returns empty mcpServers for empty array', () => {
    const config = buildMcpConfig([])
    expect(config.mcpServers).toEqual({})
  })
})
