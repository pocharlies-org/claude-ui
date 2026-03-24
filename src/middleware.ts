export { auth as middleware } from '@/lib/auth-config'

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     * - /login (sign-in page)
     * - /api/auth (NextAuth endpoints)
     * - /api/health (liveness probe)
     * - /api/webhook (machine-to-machine, bearer token auth)
     * - /_next (Next.js internals)
     * - /favicon.ico, /public assets
     */
    '/((?!login|api/auth|api/health|api/webhook|_next|favicon\\.ico|public).*)',
  ],
}
