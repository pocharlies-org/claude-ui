'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

interface CredentialStatus {
  linked: boolean
  linkedAt: string | null
}

export function CredentialUpload() {
  const [status, setStatus] = useState<CredentialStatus | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get('/user/credentials')
      setStatus(data)
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const text = await file.text()
      const data = await api.post('/user/credentials', { credentials: text })
      setStatus({ linked: true, linkedAt: data.linkedAt })
      setSuccess('Claude credentials linked successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleUnlink = async () => {
    setError(null)
    setSuccess(null)
    try {
      await api.delete('/user/credentials')
      setStatus({ linked: false, linkedAt: null })
      setSuccess('Credentials unlinked')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink')
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="text-sm font-semibold">Claude Account</h3>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-green-500/50 bg-green-500/10 p-2.5 text-xs text-green-600">
          {success}
        </div>
      )}

      {status?.linked ? (
        <div className="rounded-md border border-green-600/30 bg-green-950/20 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-green-500">Claude account linked</div>
              {status.linkedAt && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Linked {new Date(status.linkedAt).toLocaleDateString()}
                </div>
              )}
            </div>
            <button
              onClick={handleUnlink}
              className="text-xs px-2.5 py-1 rounded border hover:bg-muted transition-colors"
            >
              Unlink
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-4 text-center space-y-2">
          <div className="text-xs text-muted-foreground">No Claude credentials linked</div>
          <div className="text-[10px] text-muted-foreground">
            Run <code className="bg-muted px-1 py-0.5 rounded text-[10px]">claude auth login</code> locally, then upload the file
          </div>
          <label className="inline-block">
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            <span className="inline-flex items-center px-3 py-1.5 text-xs rounded border cursor-pointer hover:bg-muted transition-colors">
              {uploading ? 'Uploading...' : 'Upload ~/.claude/.credentials.json'}
            </span>
          </label>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground">
        Your credentials are AES-256 encrypted at rest. The raw file is never stored on the server.
      </div>
    </div>
  )
}
