const BASE = '/api'
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_CLAUDE_UI_SECRET ?? ''}`,
})

async function handleResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  get: (path: string) => fetch(`${BASE}${path}`, { headers: headers() }).then(handleResponse),
  post: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  put: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handleResponse),
  delete: (path: string) =>
    fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers() }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }),
}
