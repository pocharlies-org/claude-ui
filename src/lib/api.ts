const BASE = '/api'

const headers = (): HeadersInit => ({
  'Content-Type': 'application/json',
})

async function handleResponse(res: Response) {
  if (res.status === 401) {
    // Redirect to login on auth failure
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  get: (path: string) =>
    fetch(`${BASE}${path}`, { headers: headers(), credentials: 'same-origin' }).then(handleResponse),
  post: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: headers(),
      credentials: 'same-origin',
      body: JSON.stringify(body),
    }).then(handleResponse),
  put: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: headers(),
      credentials: 'same-origin',
      body: JSON.stringify(body),
    }).then(handleResponse),
  delete: (path: string) =>
    fetch(`${BASE}${path}`, {
      method: 'DELETE',
      headers: headers(),
      credentials: 'same-origin',
    }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    }),
}
