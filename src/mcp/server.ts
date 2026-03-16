import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import http from 'http'
import { z } from 'zod'
import { handleExecuteSession, handleGetExecution, handleListSessions } from './handlers'
import { logger } from '@/lib/logger'

export async function startMcpServer(port = 3100) {
  const server = new McpServer({ name: 'claude-ui', version: '1.0.0' })

  server.tool(
    'execute_session',
    {
      sessionId: z.string(),
      prompt: z.string(),
      soul: z.string().optional(),
      skills: z.array(z.string()).optional(),
      rules: z.array(z.string()).optional(),
    },
    async (params) => {
      try {
        const result = await handleExecuteSession(params)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      } catch (err) {
        throw new Error(String(err))
      }
    }
  )

  server.tool('list_sessions', {}, async () => {
    try {
      const result = await handleListSessions()
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    } catch (err) {
      throw new Error(String(err))
    }
  })

  server.tool(
    'get_execution',
    { executionId: z.string() },
    async (params) => {
      try {
        const result = await handleGetExecution(params)
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      } catch (err) {
        throw new Error(String(err))
      }
    }
  )

  // Track active SSE transports by sessionId
  const activeTransports = new Map<string, SSEServerTransport>()

  const httpServer = http.createServer(async (req, res) => {
    // Validate Bearer token
    const auth = req.headers['authorization'] ?? ''
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== process.env.CLAUDE_UI_SECRET) {
      res.writeHead(401)
      res.end('Unauthorized')
      return
    }

    const url = new URL(req.url!, `http://localhost:${port}`)

    if (url.pathname === '/sse' && req.method === 'GET') {
      const transport = new SSEServerTransport('/messages', res)
      // Register close BEFORE connect to avoid race condition
      res.on('close', () => activeTransports.delete(transport.sessionId))
      await server.connect(transport)
      activeTransports.set(transport.sessionId, transport)
    } else if (url.pathname === '/messages' && req.method === 'POST') {
      const sessionId = url.searchParams.get('sessionId')
      const transport = sessionId ? activeTransports.get(sessionId) : undefined
      if (!transport) {
        res.writeHead(404)
        res.end('Session not found')
        return
      }
      await transport.handlePostMessage(req, res)
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  httpServer.listen(port, () => {
    logger.info({ port }, 'MCP server listening')
  })
}
