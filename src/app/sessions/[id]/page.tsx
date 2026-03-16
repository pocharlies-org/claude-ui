'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function SessionEditPage() {
  const params = useParams()
  const router = useRouter()
  const isNew = params.id === 'new'
  const [loading, setLoading] = useState(!isNew)
  const [mcpOptions, setMcpOptions] = useState<string[]>([])
  const [form, setForm] = useState({
    name: '', description: '', soul: '', skills: '', rules: '',
    mcpServers: [] as string[], model: 'claude-opus-4-6', maxTurns: '', maxConcurrent: '1',
  })

  useEffect(() => {
    api.get('/litellm/mcp-servers')
      .then(d => setMcpOptions(d.servers ?? []))
      .catch(err => console.error('Failed to load MCP servers', err))
    if (!isNew) {
      api.get(`/sessions/${params.id}`)
        .then(s => {
          setForm({
            name: s.name, description: s.description ?? '',
            soul: s.soul,
            skills: s.skills.join('\n---\n'),
            rules: s.rules.join('\n---\n'),
            mcpServers: s.mcpServers,
            model: s.model,
            maxTurns: s.maxTurns?.toString() ?? '',
            maxConcurrent: s.maxConcurrent?.toString() ?? '1',
          })
          setLoading(false)
        })
        .catch(err => { console.error('Failed to load session', err); setLoading(false) })
    }
  }, [isNew, params.id])

  const save = async () => {
    const payload = {
      name: form.name, description: form.description || undefined,
      soul: form.soul,
      skills: form.skills.split('\n---\n').filter(Boolean),
      rules: form.rules.split('\n---\n').filter(Boolean),
      mcpServers: form.mcpServers,
      model: form.model,
      maxTurns: form.maxTurns ? Number(form.maxTurns) : undefined,
      maxConcurrent: Number(form.maxConcurrent),
    }
    try {
      if (isNew) await api.post('/sessions', payload)
      else await api.put(`/sessions/${params.id}`, payload)
      router.push('/sessions')
    } catch (err) {
      console.error('Failed to save session', err)
    }
  }

  const toggleMcp = (name: string) => {
    setForm(f => ({
      ...f,
      mcpServers: f.mcpServers.includes(name)
        ? f.mcpServers.filter(m => m !== name)
        : [...f.mcpServers, name],
    }))
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{isNew ? 'New Session' : 'Edit Session'}</h1>
      <div className="space-y-4">
        <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div><Label>Soul (system prompt)</Label><Textarea rows={6} value={form.soul} onChange={e => setForm(f => ({ ...f, soul: e.target.value }))} /></div>
        <div><Label>Skills (separate with ---)</Label><Textarea rows={4} value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} /></div>
        <div><Label>Rules (separate with ---)</Label><Textarea rows={4} value={form.rules} onChange={e => setForm(f => ({ ...f, rules: e.target.value }))} /></div>
        <div><Label>Model</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} /></div>
        <div><Label>Max Turns</Label><Input type="number" value={form.maxTurns} onChange={e => setForm(f => ({ ...f, maxTurns: e.target.value }))} placeholder="Unlimited" /></div>
        <div><Label>Max Concurrent</Label><Input type="number" min={1} value={form.maxConcurrent} onChange={e => setForm(f => ({ ...f, maxConcurrent: e.target.value }))} /></div>
        {mcpOptions.length > 0 && (
          <div>
            <Label>MCP Servers (from LiteLLM)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {mcpOptions.map(m => (
                <button key={m} type="button"
                  onClick={() => toggleMcp(m)}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${form.mcpServers.includes(m) ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
        <Button onClick={save}>Save Session</Button>
      </div>
    </div>
  )
}
