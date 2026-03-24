import { db } from './db'

/**
 * Returns a Prisma `where` filter for user-scoped queries.
 * Admins get no filter (see all), regular users get filtered by their ID.
 */
export function userScopeFilter(userId: string, isAdmin: boolean) {
  return isAdmin ? {} : { createdBy: userId }
}

/**
 * Asserts that a user owns a given agent session.
 * Throws a descriptive error if the session doesn't exist or the user doesn't own it.
 */
export async function assertSessionOwnership(
  sessionId: string,
  userId: string,
  isAdmin: boolean
): Promise<void> {
  const session = await db.agentSession.findUnique({
    where: { id: sessionId },
    select: { createdBy: true },
  })
  if (!session) throw new Error('Session not found')
  if (!isAdmin && session.createdBy !== null && session.createdBy !== userId) {
    throw new Error('Forbidden')
  }
}

/**
 * Returns a Prisma `where` filter for executions scoped to user's sessions.
 * Admins see all. Regular users see only executions from sessions they own.
 */
export async function userExecutionFilter(userId: string, isAdmin: boolean) {
  if (isAdmin) return {}
  const sessionIds = await db.agentSession.findMany({
    where: { createdBy: userId },
    select: { id: true },
  })
  return { sessionId: { in: sessionIds.map(s => s.id) } }
}
