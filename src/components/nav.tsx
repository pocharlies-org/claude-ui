'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  return (
    <nav className="flex flex-col gap-1 p-4 w-48 border-r min-h-screen">
      <div className="font-semibold text-sm mb-4">claude-ui</div>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors',
            pathname.startsWith(href) && 'bg-muted font-medium'
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
