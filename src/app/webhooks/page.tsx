'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface WebhookToken { id: string; name: string; sessionId: string; createdAt: string; lastUsedAt?: string }

export default function WebhooksPage() {
  const [tokens, setTokens] = useState<WebhookToken[]>([])
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({ name: '', sessionId: '' })
  const [newToken, setNewToken] = useState<string | null>(null)

  useEffect(() => {
    api.get('/webhooks').then(setTokens).catch(err => console.error('Failed to load webhooks', err))
    api.get('/sessions')
      .then((s: { id: string; name: string }[]) => setSessions(s))
      .catch(err => console.error('Failed to load sessions', err))
  }, [])

  const create = async () => {
    try {
      const result = await api.post('/webhooks', form)
      setNewToken(result.token)
      setTokens(t => [{ id: result.id, name: result.name, sessionId: form.sessionId, createdAt: result.createdAt }, ...t])
      setForm({ name: '', sessionId: '' })
    } catch (err) {
      console.error('Failed to create webhook', err)
    }
  }

  const revoke = async (id: string) => {
    await api.delete(`/webhooks/${id}`).catch(err => console.error('Failed to revoke webhook', err))
    setTokens(t => t.filter(x => x.id !== id))
  }

  const sessionName = (id: string) => sessions.find(s => s.id === id)?.name ?? id.slice(-8)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Webhooks</h1>
      {newToken && (
        <div className="border border-green-500 rounded-lg p-4 bg-green-50 text-sm">
          <strong>New token (shown once):</strong>
          <code className="block mt-2 break-all font-mono text-xs">{newToken}</code>
          <p className="mt-2 text-muted-foreground">Use as: <code>Authorization: Bearer {newToken}</code></p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setNewToken(null)}>Dismiss</Button>
        </div>
      )}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Create Token</h2>
        <Input placeholder="Token name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <select className="w-full border rounded px-3 py-2 text-sm" value={form.sessionId}
          onChange={e => setForm(f => ({ ...f, sessionId: e.target.value }))}>
          <option value="">Select session...</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button onClick={create} disabled={!form.name || !form.sessionId}>Create</Button>
      </div>
      <div className="space-y-3">
        {tokens.map(t => (
          <div key={t.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-muted-foreground">Session: {sessionName(t.sessionId)}</div>
              {t.lastUsedAt && <div className="text-xs text-muted-foreground">Last used: {new Date(t.lastUsedAt).toLocaleString()}</div>}
            </div>
            <Button variant="destructive" size="sm" onClick={() => revoke(t.id)}>Revoke</Button>
          </div>
        ))}
      </div>
    </div>
  )
}
