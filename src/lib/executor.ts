import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from './db'
import { logger } from './logger'

const DATA_TMP = process.env.DATA_TMP ?? '/data/tmp'
const MAX_OUTPUT_BYTES = 500 * 1024 // 500KB

export interface ExecuteParams {
  executionId: string
  sessionId: string
  prompt: string
  soul: string
  skills: string
  rules: string
  mcpServers: string
  model: string
  maxTurns?: number | null
  soulOverride?: string | null
  skillsOverride?: string | null
  rulesOverride?: string | null
}

export function buildSystemPrompt(params: {
  soul: string
  skills: string
  rules: string
  soulOverride?: string | null
  skillsOverride?: string | null
  rulesOverride?: string | null
}): string {
  const effectiveSoul = params.soulOverride ?? params.soul
  const baseSkills: string[] = JSON.parse(params.skills)
  const baseRules: string[] = JSON.parse(params.rules)
  const extraSkills: string[] = params.skillsOverride ? JSON.parse(params.skillsOverride) : []
  const extraRules: string[] = params.rulesOverride ? JSON.parse(params.rulesOverride) : []
  return [effectiveSoul, ...baseSkills, ...extraSkills, ...baseRules, ...extraRules]
    .filter(Boolean)
    .join('\n\n')
}

export function buildMcpConfig(mcpServerNames: string[]): { mcpServers: Record<string, { url: string; type: string }> } {
  const litellmUrl = process.env.LITELLM_URL ?? 'http://litellm:4000'
  return {
    mcpServers: Object.fromEntries(
      mcpServerNames.map(name => [name, { url: `${litellmUrl}/mcp`, type: 'sse' }])
    ),
  }
}

// SSE client registry — executionId → set of response writers
const sseClients = new Map<string, Set<(data: string) => void>>()

export function registerSseClient(executionId: string, writer: (data: string) => void) {
  if (!sseClients.has(executionId)) sseClients.set(executionId, new Set())
  sseClients.get(executionId)!.add(writer)
}

export function unregisterSseClient(executionId: string, writer: (data: string) => void) {
  sseClients.get(executionId)?.delete(writer)
}

function broadcastToSse(executionId: string, data: string) {
  sseClients.get(executionId)?.forEach(writer => writer(data))
}

/** Append a chunk immutably. Returns the updated array and whether the cap was hit. */
function appendChunk(
  chunks: string[],
  chunk: string,
  totalBytes: number
): { chunks: string[]; truncated: boolean; totalBytes: number } {
  if (totalBytes + chunk.length > MAX_OUTPUT_BYTES) {
    const truncationNotice = '\n[Output truncated — exceeded 500KB limit]'
    return {
      chunks: [...chunks, truncationNotice],
      truncated: true,
      totalBytes: totalBytes + truncationNotice.length,
    }
  }
  return { chunks: [...chunks, chunk], truncated: false, totalBytes: totalBytes + chunk.length }
}

/** Persist execution result, broadcast SSE done event, and clean up. */
async function persistCompletion(
  executionId: string,
  code: number | null,
  output: string,
  startedAt: Date,
  configPath: string
): Promise<void> {
  const now = new Date()
  const status = code === 0 ? 'completed' : 'failed'

  try {
    await db.execution.update({
      where: { id: executionId },
      data: {
        status,
        exitCode: code,
        output,
        completedAt: now,
        durationMs: now.getTime() - startedAt.getTime(),
      },
    })
  } finally {
    await fs.unlink(configPath).catch(() => {})
    broadcastToSse(
      executionId,
      `data: ${JSON.stringify({ type: 'done', status, exitCode: code })}\n\n`
    )
    sseClients.delete(executionId)
    logger.info({ executionId, status, exitCode: code }, 'Execution complete')
  }
}

export async function recoverOrphanedExecutions() {
  const orphans = await db.execution.findMany({ where: { status: 'running' } })
  if (orphans.length === 0) return

  logger.warn({ count: orphans.length }, 'Recovering orphaned executions from previous crash')
  const now = new Date()
  for (const exec of orphans) {
    await db.execution.update({
      where: { id: exec.id },
      data: {
        status: 'failed',
        completedAt: now,
        durationMs: now.getTime() - exec.startedAt.getTime(),
        output: (exec.output ?? '') + '\n[Process interrupted — pod restarted]',
      },
    })
  }

  // Purge any leftover temp config files
  try {
    const files = await fs.readdir(DATA_TMP)
    await Promise.all(files.map(f => fs.unlink(path.join(DATA_TMP, f)).catch(() => {})))
  } catch {
    // DATA_TMP may not exist in dev
  }
}

export async function executeSession(params: ExecuteParams): Promise<void> {
  const configPath = path.join(DATA_TMP, `${params.executionId}.json`)
  const mcpServerNames: string[] = JSON.parse(params.mcpServers)
  const mcpConfig = buildMcpConfig(mcpServerNames)

  // Ensure tmp dir exists
  await fs.mkdir(DATA_TMP, { recursive: true })

  // Write temp MCP config with restricted permissions
  await fs.writeFile(configPath, JSON.stringify(mcpConfig), { mode: 0o600 })

  const systemPrompt = buildSystemPrompt(params)
  const args = [
    '-p', params.prompt,
    '--system-prompt', systemPrompt,
    '--mcp-config', configPath,
    '--output-format', 'stream-json',
    '--model', params.model,
    // --dangerously-skip-permissions: required for non-interactive claude CLI execution in K8s.
    // claude-ui is an internal cluster tool; all sessions are configured by admins.
    // All MCP tool calls are gated by the session's mcpServers allowlist via LiteLLM.
    '--dangerously-skip-permissions',
    ...(params.maxTurns ? ['--max-turns', String(params.maxTurns)] : []),
  ]

  logger.info({ executionId: params.executionId, sessionId: params.sessionId }, 'Spawning claude CLI')

  const proc = spawn('claude', args, { env: { ...process.env } })
  let outputChunks: string[] = []
  let totalBytes = 0
  let truncated = false

  // SSE heartbeat every 30s
  const heartbeat = setInterval(() => {
    broadcastToSse(params.executionId, 'data: {"type":"heartbeat"}\n\n')
  }, 30_000)

  proc.stdout.on('data', (data: Buffer) => {
    if (truncated) return
    const chunk = data.toString()
    const result = appendChunk(outputChunks, chunk, totalBytes)
    outputChunks = result.chunks
    totalBytes = result.totalBytes
    if (result.truncated) {
      truncated = true
    } else {
      broadcastToSse(params.executionId, `data: ${JSON.stringify({ type: 'output', text: chunk })}\n\n`)
    }
  })

  proc.stderr.on('data', (data: Buffer) => {
    logger.debug({ executionId: params.executionId }, `stderr: ${data.toString()}`)
  })

  proc.on('close', async (code) => {
    clearInterval(heartbeat)
    const startedAt =
      (await db.execution.findUnique({ where: { id: params.executionId } }))?.startedAt ?? new Date()
    await persistCompletion(params.executionId, code, outputChunks.join(''), startedAt, configPath)
  })

  proc.on('error', async (err) => {
    clearInterval(heartbeat)
    logger.error({ executionId: params.executionId, err }, 'Failed to spawn claude CLI')
    const output = `Error: ${err.message}`
    const started =
      (await db.execution.findUnique({ where: { id: params.executionId } }))?.startedAt ?? new Date()
    await persistCompletion(params.executionId, null, output, started, configPath)
  })
}
