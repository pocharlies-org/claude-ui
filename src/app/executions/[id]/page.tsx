'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import '@xterm/xterm/css/xterm.css'

export default function ExecutionDetailPage() {
  const { id } = useParams() as { id: string }
  const termRef = useRef<HTMLDivElement>(null)
  const thinkingRef = useRef<HTMLPreElement>(null)
  const [execution, setExecution] = useState<{
    id: string; status: string; prompt: string; triggeredBy: string;
    startedAt: string; completedAt?: string; durationMs?: number;
  } | null>(null)
  const [thinking, setThinking] = useState('')
  const [thinkingOpen, setThinkingOpen] = useState(false)

  useEffect(() => {
    api.get(`/executions/${id}`)
      .then(setExecution)
      .catch(err => console.error('Failed to load execution', err))
  }, [id])

  // Auto-scroll thinking panel when new content arrives
  useEffect(() => {
    if (thinkingRef.current && thinkingOpen) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight
    }
  }, [thinking, thinkingOpen])

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

      const es = new EventSource(`/api/executions/${id}/stream`)
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'thinking') {
            setThinking(prev => prev + msg.text)
          }
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

      {/* Thinking panel — collapsible, only shown when thinking content exists */}
      {thinking && (
        <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 overflow-hidden">
          <button
            onClick={() => setThinkingOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-purple-300 hover:bg-purple-950/30 transition-colors"
          >
            <span>
              Thinking
              {execution?.status === 'running' && (
                <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              )}
            </span>
            <span className="text-xs text-purple-400">
              {thinkingOpen ? 'Collapse' : 'Expand'} ({thinking.length.toLocaleString()} chars)
            </span>
          </button>
          {thinkingOpen && (
            <pre
              ref={thinkingRef}
              className="px-4 py-3 text-xs text-purple-200/80 whitespace-pre-wrap break-words max-h-64 overflow-y-auto border-t border-purple-500/20 font-mono"
            >
              {thinking}
            </pre>
          )}
        </div>
      )}

      <div ref={termRef} className="rounded-lg overflow-hidden" style={{ height: '500px' }} />
    </div>
  )
}
