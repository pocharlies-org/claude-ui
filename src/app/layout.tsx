import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import './globals.css'
import { LayoutShell } from '@/components/layout-shell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'claude-ui',
  description: 'Claude Agent Orchestration Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <LayoutShell>{children}</LayoutShell>
        </SessionProvider>
      </body>
    </html>
  )
}
