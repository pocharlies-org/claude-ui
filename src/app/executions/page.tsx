'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import Link from 'next/link'

interface Execution {
  id: string; sessionId: string; triggeredBy: string;
  status: string; startedAt: string; durationMs: number | null;
}

const statusColor: Record<string, string> = {
  running: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export default function ExecutionsPage() {
  const [data, setData] = useState<{ executions: Execution[]; total: number }>({ executions: [], total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/executions?limit=50')
      .then(d => { setData(d); setLoading(false) })
      .catch(err => { console.error('Failed to load executions', err); setLoading(false) })
  }, [])

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Executions</h1>
      <table className="w-full text-sm border-collapse">
        <thead><tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4">ID</th><th className="py-2 pr-4">Session</th>
          <th className="py-2 pr-4">Trigger</th><th className="py-2 pr-4">Status</th>
          <th className="py-2 pr-4">Started</th><th className="py-2">Duration</th>
        </tr></thead>
        <tbody>
          {data.executions.map(e => (
            <tr key={e.id} className="border-b hover:bg-muted/50">
              <td className="py-2 pr-4 font-mono text-xs">
                <Link href={`/executions/${e.id}`} className="underline">{e.id.slice(-8)}</Link>
              </td>
              <td className="py-2 pr-4 font-mono text-xs">{e.sessionId.slice(-8)}</td>
              <td className="py-2 pr-4">{e.triggeredBy}</td>
              <td className="py-2 pr-4">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[e.status] ?? ''}`}>{e.status}</span>
              </td>
              <td className="py-2 pr-4">{new Date(e.startedAt).toLocaleString()}</td>
              <td className="py-2">{e.durationMs ? `${(e.durationMs / 1000).toFixed(1)}s` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
