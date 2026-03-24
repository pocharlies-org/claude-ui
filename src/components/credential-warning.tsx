'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'

/**
 * Shows a warning banner when the authenticated user has no Claude credentials linked.
 * Renders nothing for unauthenticated users or users with credentials.
 */
export function CredentialWarning() {
  const { data: session } = useSession()
  const user = session?.user as { hasCredentials?: boolean } | undefined

  if (!user || user.hasCredentials) return null

  return (
    <div className="rounded-md border border-yellow-600/30 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-500">
      You need to link your Claude account before running sessions.{' '}
      <Link href="/settings" className="underline hover:text-yellow-400">
        Go to Settings
      </Link>
    </div>
  )
}
