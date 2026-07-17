import { Orchestrator } from '@fonagents/core'
import type { OrchestratorConfig } from '@fonagents/core'
import { BeadsAdapter } from '@fonagents/beads-adapter'
import { AnagentAdapter } from '@fonagents/anagent-adapter'
import { createHttpSseApp, SseEventBus, writeMcpConfig, type McpConfigFormat } from '@fonagents/http-sse-adapter'
import express from 'express'
import type { Express } from 'express'
import path from 'path'
import fs from 'fs'

export interface DaemonConfig {
  port?: number
  projectDir?: string
  bdPath?: string
  anagentPath?: string
  managerRuntimeId?: string
}

export function startDaemon(opts: DaemonConfig = {}): void {
  const projectDir = opts.projectDir ?? process.env.PROJECT_DIR ?? process.cwd()
  const port = opts.port ?? parseInt(process.env.PORT ?? '3001', 10)

  const eventBus = new SseEventBus()

  const managerRuntime = opts.managerRuntimeId ?? process.env.MANAGER_RUNTIME ?? 'opencode'
  const mcpFormat: McpConfigFormat = managerRuntime === 'claude-code' ? 'claude-code' : 'opencode'
  const pkgRoot = path.resolve(__dirname, '../..')
  const mcpServerScript = path.join(pkgRoot, 'adapters/http-sse/dist/mcp-server.js')
  const mcpConfigPath = writeMcpConfig({
    daemonUrl: `http://localhost:${port}`,
    mcpServerScript,
    format: mcpFormat,
  })

  if (mcpFormat === 'opencode') {
    const projectOpencodeDir = path.join(projectDir, '.opencode')
    fs.mkdirSync(projectOpencodeDir, { recursive: true })
    const destConfig = path.join(projectOpencodeDir, 'opencode.json')
    const srcConfig = path.join(path.dirname(mcpConfigPath), 'opencode.json')
    if (fs.existsSync(destConfig)) {
      try {
        const existing = JSON.parse(fs.readFileSync(destConfig, 'utf8'))
        const mcpSection = JSON.parse(fs.readFileSync(srcConfig, 'utf8'))
        existing.mcp = { ...(existing.mcp ?? {}), ...mcpSection.mcp }
        fs.writeFileSync(destConfig, JSON.stringify(existing, null, 2), 'utf8')
      } catch {
        fs.copyFileSync(srcConfig, destConfig)
      }
    } else {
      fs.copyFileSync(srcConfig, destConfig)
    }
  }

  const tracker = new BeadsAdapter({
    bdPath: opts.bdPath ?? process.env.BD_PATH,
    projectDir,
    actor: process.env.BEADS_ACTOR,
  })

  const runtime = new AnagentAdapter({
    anagentPath: opts.anagentPath ?? process.env.ANAGENT_PATH,
    cwd: projectDir,
  })

  const orchestratorConfig: OrchestratorConfig = {
    projectDir,
    managerRuntimeId: managerRuntime,
  }

  const orchestrator = new Orchestrator(tracker, runtime, eventBus, orchestratorConfig)

  const { app } = createHttpSseApp(orchestrator, orchestrator, eventBus, { port, projectDir })

  const beadsUiDist = path.join(pkgRoot, 'beads-ui/dist')
  if (fs.existsSync(beadsUiDist)) {
    app.use(express.static(beadsUiDist))
    app.get('/*path', (req, res) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Not found' })
        return
      }
      res.sendFile(path.join(beadsUiDist, 'index.html'))
    })
  }

  const server = app.listen(port, () => {
    console.log(`fonagents daemon: http://localhost:${port}`)
    console.log(`Project:          ${projectDir}`)
    console.log(`MCP config:       ${mcpConfigPath}`)
    console.log(`Events:           GET /api/events (SSE)`)
  })

  const shutdown = async () => {
    console.log('\nShutting down...')
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 5000).unref()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
