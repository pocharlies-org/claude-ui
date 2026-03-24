import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from './db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider === 'google') {
        return profile?.email?.endsWith('@cloudblue.com') ?? false
      }
      return false
    },
    session({ session, user }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: (user as { id: string }).id,
          isAdmin: (user as { isAdmin?: boolean }).isAdmin ?? false,
          hasCredentials: !!(user as { credentialsLinkedAt?: Date | null }).credentialsLinkedAt,
        },
      }
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
})
