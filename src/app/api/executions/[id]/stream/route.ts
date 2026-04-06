import { NextRequest } from 'next/server'
import { validateBearerToken, getAuthUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { registerSseClient, unregisterSseClient } from '@/lib/executor'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth: try NextAuth session first (browser), then bearer token (scripts/MCP)
  const user = await getAuthUser()
  if (!user) {
    const tokenFromQuery = req.nextUrl.searchParams.get('token')
    const authHeader = req.headers.get('authorization') ?? (tokenFromQuery ? `Bearer ${tokenFromQuery}` : undefined)
    if (!validateBearerToken(authHeader)) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const execution = await db.execution.findUnique({ where: { id } })
  if (!execution) return new Response('Not found', { status: 404 })

  // If already completed, return the stored output as SSE events (with thinking extracted)
  if (execution.status !== 'running') {
    const output = execution.output ?? ''
    const events: string[] = []

    // Extract thinking from stored stream-json output
    const lines = output.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const event = JSON.parse(trimmed)
        if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
          for (const block of event.message.content) {
            if (block.type === 'thinking' && block.thinking) {
              events.push(`data: ${JSON.stringify({ type: 'thinking', text: block.thinking })}\n\n`)
            }
          }
        }
      } catch {
        // not JSON — skip
      }
    }

    events.push(`data: ${JSON.stringify({ type: 'output', text: output })}\n\n`)
    events.push(`data: ${JSON.stringify({ type: 'done', status: execution.status, exitCode: execution.exitCode })}\n\n`)

    return new Response(events.join(''), {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }

  const stream = new ReadableStream({
    start(controller) {
      const writer = (data: string) => {
        try { controller.enqueue(new TextEncoder().encode(data)) } catch { /* closed */ }
      }
      registerSseClient(id, writer)

      req.signal.addEventListener('abort', () => {
        unregisterSseClient(id, writer)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
