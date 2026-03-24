export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { recoverOrphanedExecutions } = await import('./lib/executor')
    const { startMcpServer } = await import('./mcp/server')
    const { startAllCronJobs } = await import('./cron/scheduler')

    const { ensureAdminUser } = await import('./lib/seed-admin')

    await ensureAdminUser()
    await recoverOrphanedExecutions()
    await startMcpServer(Number(process.env.MCP_PORT ?? 3100))
    await startAllCronJobs()
  }
}
