import { db } from './db'
import { logger } from './logger'

/**
 * Ensures an admin user exists on startup.
 * If ADMIN_EMAIL is set, upserts that email as an admin.
 */
export async function ensureAdminUser(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return

  await db.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, isAdmin: true, updatedAt: new Date() },
    update: { isAdmin: true },
  })
  logger.info({ email: adminEmail }, 'Admin user ensured')
}
