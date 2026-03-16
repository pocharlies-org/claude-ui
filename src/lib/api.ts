const BASE = '/api'
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.NEXT_PUBLIC_CLAUDE_UI_SECRET ?? ''}`,
})

export const api = {
  get: (path: string) => fetch(`${BASE}${path}`, { headers: headers() }).then(r => r.json()),
  post: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
  put: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
  delete: (path: string) =>
    fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers() }),
}
