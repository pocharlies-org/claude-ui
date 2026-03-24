import cron, { type ScheduledTask } from 'node-cron'
import { db } from '@/lib/db'
import { executeSession } from '@/lib/executor'
import { logger } from '@/lib/logger'

const jobs = new Map<string, ScheduledTask>()

export function registerCronJob(cronJob: {
  id: string; schedule: string; timezone: string; sessionId: string;
  prompt: string; soulOverride: string | null; enabled: boolean;
}) {
  unregisterCronJob(cronJob.id)
  if (!cron.validate(cronJob.schedule)) {
    logger.warn({ cronId: cronJob.id }, 'Invalid cron expression — skipping')
    return
  }
  const task = cron.schedule(cronJob.schedule, async () => {
    const session = await db.agentSession.findUnique({ where: { id: cronJob.sessionId } })
    if (!session) return
    const execution = await db.execution.create({
      data: {
        sessionId: cronJob.sessionId,
        triggeredBy: 'cron',
        triggerSource: `cron:${cronJob.id}`,
        prompt: cronJob.prompt,
        soulOverride: cronJob.soulOverride,
        status: 'running',
      },
    })
    await db.cronJob.update({ where: { id: cronJob.id }, data: { lastRunAt: new Date() } })
    executeSession({
      executionId: execution.id, sessionId: cronJob.sessionId,
      prompt: cronJob.prompt, soul: session.soul, skills: session.skills,
      rules: session.rules, mcpServers: session.mcpServers, model: session.model,
      maxTurns: session.maxTurns, soulOverride: cronJob.soulOverride,
    }).catch(err => logger.error({ err, cronId: cronJob.id }, 'Cron execution error'))
  }, { timezone: cronJob.timezone })
  jobs.set(cronJob.id, task)
  logger.info({ cronId: cronJob.id, schedule: cronJob.schedule }, 'Cron job registered')
}

export function unregisterCronJob(id: string) {
  const existing = jobs.get(id)
  if (existing) { existing.stop(); jobs.delete(id) }
}

export async function startAllCronJobs() {
  const enabledCrons = await db.cronJob.findMany({ where: { enabled: true } })
  enabledCrons.forEach(registerCronJob)
  logger.info({ count: enabledCrons.length }, 'Cron scheduler started')
}
