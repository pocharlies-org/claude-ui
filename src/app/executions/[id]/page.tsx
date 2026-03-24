'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import '@xterm/xterm/css/xterm.css'

export default function ExecutionDetailPage() {
  const { id } = useParams() as { id: string }
  const termRef = useRef<HTMLDivElement>(null)
  const [execution, setExecution] = useState<{
    id: string; status: string; prompt: string; triggeredBy: string;
    startedAt: string; completedAt?: string; durationMs?: number;
  } | null>(null)

  useEffect(() => {
    api.get(`/executions/${id}`)
      .then(setExecution)
      .catch(err => console.error('Failed to load execution', err))
  }, [id])

  useEffect(() => {
    if (!termRef.current) return
    let term: import('@xterm/xterm').Terminal
    let fitAddon: import('@xterm/addon-fit').FitAddon

    const init = async () => {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')

      term = new Terminal({ theme: { background: '#0f172a', foreground: '#e2e8f0' } })
      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(termRef.current!)
      fitAddon.fit()

      // EventSource sends cookies automatically for same-origin requests (NextAuth session)
      const es = new EventSource(`/api/executions/${id}/stream`)
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'output') term.write(msg.text)
          if (msg.type === 'done') {
            term.write(`\r\n\x1b[32m[Done: ${msg.status}]\x1b[0m\r\n`)
            setExecution(prev => prev ? { ...prev, status: msg.status } : prev)
            es.close()
          }
        } catch (err) {
          console.error('Failed to parse SSE message', err)
        }
      }
      return () => es.close()
    }
    const cleanup = init()
    return () => { cleanup.then(fn => fn?.()) }
  }, [id])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Execution</h1>
      {execution && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>ID: <code>{execution.id}</code></span>
          <span>Trigger: {execution.triggeredBy}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            execution.status === 'running' ? 'bg-yellow-100 text-yellow-800' :
            execution.status === 'completed' ? 'bg-green-100 text-green-800' :
            execution.status === 'failed' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>{execution.status}</span>
          {execution.durationMs && <span>{(execution.durationMs / 1000).toFixed(1)}s</span>}
        </div>
      )}
      {execution?.prompt && (
        <div className="bg-muted rounded p-3 text-sm font-mono">{execution.prompt}</div>
      )}
      <div ref={termRef} className="rounded-lg overflow-hidden" style={{ height: '500px' }} />
    </div>
  )
}
