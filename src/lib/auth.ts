export function validateBearerToken(authHeader: string | undefined): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  return token === process.env.CLAUDE_UI_SECRET
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}
