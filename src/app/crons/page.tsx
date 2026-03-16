'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CronJob {
  id: string; name: string; schedule: string; timezone: string;
  sessionId: string; prompt: string; enabled: boolean; lastRunAt?: string;
}

export default function CronsPage() {
  const [crons, setCrons] = useState<CronJob[]>([])
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({ name: '', sessionId: '', schedule: '', timezone: 'UTC', prompt: '' })

  useEffect(() => {
    api.get('/crons').then(setCrons)
    api.get('/sessions').then((s: { id: string; name: string }[]) => setSessions(s))
  }, [])

  const toggle = async (id: string) => {
    const updated = await api.post(`/crons/${id}/toggle`, {})
    setCrons(c => c.map(x => x.id === id ? updated : x))
  }

  const create = async () => {
    const cron = await api.post('/crons', form)
    setCrons(c => [cron, ...c])
    setForm({ name: '', sessionId: '', schedule: '', timezone: 'UTC', prompt: '' })
  }

  const remove = async (id: string) => {
    await api.delete(`/crons/${id}`)
    setCrons(c => c.filter(x => x.id !== id))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Crons</h1>
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">New Cron Job</h2>
        <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <select className="w-full border rounded px-3 py-2 text-sm" value={form.sessionId}
          onChange={e => setForm(f => ({ ...f, sessionId: e.target.value }))}>
          <option value="">Select session...</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Input placeholder="Cron expression (e.g. 0 9 * * 1-5)" value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))} />
        <Input placeholder="Timezone (e.g. Europe/Madrid)" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} />
        <Input placeholder="Prompt" value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} />
        <Button onClick={create} disabled={!form.name || !form.sessionId || !form.schedule || !form.prompt}>Create</Button>
      </div>
      <div className="space-y-3">
        {crons.map(c => (
          <div key={c.id} className="border rounded-lg p-4 flex items-start justify-between">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {c.schedule} ({c.timezone}) · {c.prompt.slice(0, 60)}...
              </div>
              {c.lastRunAt && <div className="text-xs text-muted-foreground mt-1">Last run: {new Date(c.lastRunAt).toLocaleString()}</div>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toggle(c.id)}>
                {c.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => remove(c.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
