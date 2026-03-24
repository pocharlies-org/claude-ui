'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6 rounded-lg border p-8 shadow-sm max-w-sm w-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">claude-ui</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Claude Agent Orchestration Platform
            <br />
            CloudBlue DevOps
          </p>
        </div>

        <div className="w-full border-t" />

        {error && (
          <div className="w-full rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error === 'AccessDenied'
              ? 'Access denied. Only @cloudblue.com accounts are allowed.'
              : 'Something went wrong. Please try again.'}
          </div>
        )}

        <button
          onClick={() => signIn('google', { callbackUrl: '/sessions' })}
          className="flex w-full items-center justify-center gap-3 rounded-md border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z" />
          </svg>
          Sign in with Google
        </button>

        <p className="text-xs text-muted-foreground text-center">
          Only @cloudblue.com accounts are allowed
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
