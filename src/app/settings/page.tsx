'use client'
import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [health, setHealth] = useState<{ status: string; db: string } | null>(null)

  useEffect(() => { fetch('/api/health').then(r => r.json()).then(setHealth) }, [])

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="border rounded-lg p-4 space-y-2">
        <h2 className="font-medium">System Status</h2>
        {health && (
          <div className="text-sm space-y-1">
            <div>API: <span className={health.status === 'ok' ? 'text-green-600' : 'text-red-600'}>{health.status}</span></div>
            <div>Database: <span className={health.db === 'ok' ? 'text-green-600' : 'text-red-600'}>{health.db}</span></div>
          </div>
        )}
      </div>
      <div className="border rounded-lg p-4 space-y-2 text-sm text-muted-foreground">
        <h2 className="font-medium text-foreground">Configuration</h2>
        <div>LiteLLM URL: <code>{process.env.NEXT_PUBLIC_LITELLM_URL ?? '(not set)'}</code></div>
        <div>MCP Server Port: <code>{process.env.NEXT_PUBLIC_MCP_PORT ?? '3100'}</code></div>
      </div>
    </div>
  )
}
