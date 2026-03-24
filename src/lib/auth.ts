import { auth } from './auth-config'

// ─── Bearer token auth (webhooks, MCP, machine-to-machine) ───────────

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

// ─── NextAuth session auth (browser users) ────────────────────────────

export interface AuthUser {
  readonly id: string
  readonly email: string
  readonly name: string | null
  readonly isAdmin: boolean
  readonly hasCredentials: boolean
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return {
    id: session.user.id as string,
    email: session.user.email ?? '',
    name: session.user.name ?? null,
    isAdmin: (session.user as { isAdmin?: boolean }).isAdmin ?? false,
    hasCredentials: (session.user as { hasCredentials?: boolean }).hasCredentials ?? false,
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) throw unauthorizedResponse()
  return user
}

// ─── Dual auth: NextAuth session OR bearer token ──────────────────────

export type AuthResult =
  | { readonly type: 'user'; readonly user: AuthUser }
  | { readonly type: 'bearer' }

export async function validateRequest(
  authHeader: string | undefined
): Promise<AuthResult | null> {
  // Try NextAuth session first (browser cookies)
  const user = await getAuthUser()
  if (user) return { type: 'user', user }

  // Fall back to bearer token (webhooks, MCP, scripts)
  if (validateBearerToken(authHeader)) return { type: 'bearer' }

  return null
}
