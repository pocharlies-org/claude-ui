'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface Session {
  id: string; name: string; description?: string; model: string;
  mcpServers: string[]; createdAt: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/sessions').then(data => { setSessions(data); setLoading(false) })
  }, [])

  const deleteSession = async (id: string) => {
    if (!confirm('Delete this session?')) return
    await api.delete(`/sessions/${id}`)
    setSessions(s => s.filter(x => x.id !== id))
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Link href="/sessions/new">
          <Button>New Session</Button>
        </Link>
      </div>
      {sessions.length === 0 && <p className="text-muted-foreground">No sessions yet.</p>}
      <div className="space-y-3">
        {sessions.map(s => (
          <div key={s.id} className="border rounded-lg p-4 flex items-start justify-between">
            <div>
              <div className="font-medium">{s.name}</div>
              {s.description && <div className="text-sm text-muted-foreground">{s.description}</div>}
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{s.model}</Badge>
                {s.mcpServers.map(m => <Badge key={m} variant="secondary">{m}</Badge>)}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/sessions/${s.id}`}><Button variant="outline" size="sm">Edit</Button></Link>
              <Button variant="destructive" size="sm" onClick={() => deleteSession(s.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
