import { NextRequest } from 'next/server'
import { validateBearerToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { registerSseClient, unregisterSseClient } from '@/lib/executor'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // EventSource cannot set headers — accept token via query param as fallback
  const tokenFromQuery = req.nextUrl.searchParams.get('token')
  const authHeader = req.headers.get('authorization') ?? (tokenFromQuery ? `Bearer ${tokenFromQuery}` : undefined)
  if (!validateBearerToken(authHeader)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const execution = await db.execution.findUnique({ where: { id } })
  if (!execution) return new Response('Not found', { status: 404 })

  // If already completed, return the stored output as a single SSE event
  if (execution.status !== 'running') {
    const body = [
      `data: ${JSON.stringify({ type: 'output', text: execution.output ?? '' })}\n\n`,
      `data: ${JSON.stringify({ type: 'done', status: execution.status, exitCode: execution.exitCode })}\n\n`,
    ].join('')
    return new Response(body, {
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
