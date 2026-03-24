'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/sessions', label: 'Sessions' },
  { href: '/executions', label: 'Executions' },
  { href: '/crons', label: 'Crons' },
  { href: '/webhooks', label: 'Webhooks' },
  { href: '/settings', label: 'Settings' },
]

export function Nav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user

  return (
    <nav className="flex flex-col gap-1 p-4 w-48 border-r min-h-screen justify-between">
      <div>
        <div className="font-semibold text-sm mb-4">claude-ui</div>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'block px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors',
              pathname.startsWith(href) && 'bg-muted font-medium'
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {user && (
        <div className="border-t pt-3 mt-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground shrink-0">
              {user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{user.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
            </div>
          </div>
          {!(user as { hasCredentials?: boolean }).hasCredentials && (
            <Link
              href="/settings"
              className="flex items-center gap-1 mt-2 px-1 text-[10px] text-yellow-500"
            >
              Link Claude account in Settings
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="mt-2 px-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  )
}
