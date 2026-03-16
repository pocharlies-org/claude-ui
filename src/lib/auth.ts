export function validateBearerToken(authHeader: string | undefined): boolean {
  const secret = process.env.CLAUDE_UI_SECRET
  if (!secret) {
    process.stderr.write('[auth] WARNING: CLAUDE_UI_SECRET is not set — all requests will be rejected\n')
    return false
  }
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  return token === secret
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}
