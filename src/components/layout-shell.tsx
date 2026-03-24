'use client'

import { usePathname } from 'next/navigation'
import { Nav } from '@/components/nav'

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex">
      <Nav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
