import { promises as fs } from 'fs'
import path from 'path'
import { db } from './db'
import { decryptCredentials } from './crypto'

const DATA_TMP = process.env.DATA_TMP ?? '/data/tmp'

/**
 * Resolve credentials for a user. Returns the decrypted JSON string or null
 * if the user has no credentials (webhook/MCP/cron → use mounted default).
 */
export async function resolveCredentials(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { encryptedCredentials: true },
  })
  if (!user?.encryptedCredentials) return null
  return decryptCredentials(user.encryptedCredentials)
}

/**
 * Write per-user credentials to a temp directory structure that mimics HOME.
 * Returns the temp HOME path to pass as env var when spawning claude CLI.
 */
export async function prepareCredentialFiles(
  executionId: string,
  credentialsJson: string
): Promise<string> {
  const homeDir = path.join(DATA_TMP, `${executionId}-home`)
  const claudeDir = path.join(homeDir, '.claude')
  await fs.mkdir(claudeDir, { recursive: true })
  await fs.writeFile(
    path.join(claudeDir, '.credentials.json'),
    credentialsJson,
    { mode: 0o600 }
  )
  return homeDir
}

/**
 * Clean up temp credential files after execution completes.
 */
export async function cleanupCredentialFiles(executionId: string): Promise<void> {
  const homeDir = path.join(DATA_TMP, `${executionId}-home`)
  await fs.rm(homeDir, { recursive: true, force: true }).catch(() => {})
}
