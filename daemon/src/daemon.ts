import { Orchestrator } from '@fonagents/core'
import type { OrchestratorConfig } from '@fonagents/core'
import { BeadsAdapter } from '@fonagents/beads-adapter'
import { AnagentAdapter } from '@fonagents/anagent-adapter'
import { createHttpSseApp, SseEventBus, writeMcpConfig, type McpConfigFormat } from '@fonagents/http-sse-adapter'
import { Overseer, type OverseerConfig } from './overseer.js'
import express from 'express'
import type { Express } from 'express'
import path from 'path'
import fs from 'fs'
import http from 'http'

export interface DaemonConfig {
  port?: number
  projectDir?: string
  bdPath?: string
  anagentPath?: string
  managerRuntimeId?: string
}

export interface DaemonHandle {
  port: number
  mcpConfigPath: string
  projectDir: string
  managerRuntimeId: string
}

let _server: http.Server | null = null
let _projectDir: string | null = null
let _overseer: Overseer | null = null

export function daemonStatePath(projectDir: string): string {
  return path.join(projectDir, '.fonagents', 'daemon.json')
}

export function globalRegistryPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp'
  return path.join(home, '.fonagents', 'daemons.json')
}

interface DaemonEntry { port: number; projectDir: string; pid: number }

function writeStateFile(projectDir: string, port: number): void {
  const statePath = daemonStatePath(projectDir)
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  fs.writeFileSync(statePath, JSON.stringify({ port, projectDir, pid: process.pid }, null, 2), 'utf8')
  addToRegistry({ port, projectDir, pid: process.pid })
}

function removeStateFile(projectDir: string): void {
  const statePath = daemonStatePath(projectDir)
  try {
    const state: DaemonEntry = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    if (state.pid === process.pid) {
      fs.unlinkSync(statePath)
    }
  } catch { /* can't read or invalid — state already gone */ }
  removeFromRegistry(projectDir, process.pid)
}

function addToRegistry(entry: DaemonEntry): void {
  const regPath = globalRegistryPath()
  fs.mkdirSync(path.dirname(regPath), { recursive: true })
  let entries: DaemonEntry[] = []
  try { entries = JSON.parse(fs.readFileSync(regPath, 'utf8')) } catch { /* ok */ }
  entries = entries.filter(e => e.projectDir !== entry.projectDir)
  entries.push(entry)
  fs.writeFileSync(regPath, JSON.stringify(entries, null, 2), 'utf8')
}

function removeFromRegistry(projectDir: string, pid: number): void {
  const regPath = globalRegistryPath()
  try {
    let entries: DaemonEntry[] = JSON.parse(fs.readFileSync(regPath, 'utf8'))
    entries = entries.filter(e => !(e.projectDir === projectDir && e.pid === pid))
    fs.writeFileSync(regPath, JSON.stringify(entries, null, 2), 'utf8')
  } catch { /* ok */ }
}

async function checkDaemonRunning(projectDir: string): Promise<{ port: number; pid: number } | null> {
  const statePath = daemonStatePath(projectDir)
  try {
    const state: DaemonEntry = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    const alive = await new Promise<boolean>((resolve) => {
      const req = http.get(`http://localhost:${state.port}/api/health`, (res) => {
        resolve(res.statusCode === 200)
      })
      req.on('error', () => resolve(false))
      req.setTimeout(2000, () => { req.destroy(); resolve(false) })
    })
    if (alive) return state
  } catch { /* no state or invalid */ }
  return null
}

export async function startDaemon(opts: DaemonConfig = {}): Promise<DaemonHandle> {
  const projectDir = opts.projectDir ?? process.env.PROJECT_DIR ?? process.cwd()

  const existing = await checkDaemonRunning(projectDir)
  if (existing) {
    throw new Error(
      `Daemon already running for project ${projectDir} on port ${existing.port} (PID ${existing.pid}). ` +
      `Stop it first or use a different project directory.`
    )
  }

  _projectDir = projectDir
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

  const overseerConfig: OverseerConfig = {
    enabled: process.env.FONAGENTS_SUPERVISION_ENABLED !== 'false',
    mode: (process.env.FONAGENTS_SUPERVISION_MODE as 'queue' | 'batch') || 'queue',
    debounceMs: parseInt(process.env.FONAGENTS_SUPERVISION_DEBOUNCE_MS || '5000', 10),
    maxConcurrent: parseInt(process.env.FONAGENTS_SUPERVISION_MAX_CONCURRENT || '5', 10),
    timeoutSec: parseInt(process.env.FONAGENTS_SUPERVISION_TIMEOUT_SEC || '600', 10),
  }

  const orchestratorConfig: OrchestratorConfig = {
    projectDir,
    managerRuntimeId: managerRuntime,
    overseer: { enabled: overseerConfig.enabled, mode: overseerConfig.mode },
  }

  const orchestrator = new Orchestrator(tracker, runtime, eventBus, orchestratorConfig)

  _overseer = new Overseer(eventBus.events, overseerConfig, projectDir)
  _overseer.start()

  const { app } = createHttpSseApp(orchestrator, orchestrator, eventBus, { port, projectDir })

  // ── Overseer API ──────────────────────────────────────────────────────────────
  app.get('/api/overseer', (_req, res) => {
    try {
      const status = _overseer!.getStatus()
      res.json(status)
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.post('/api/overseer/toggle', (_req, res) => {
    try {
      const current = _overseer!.getConfig()
      const enabled = !current.enabled
      _overseer!.setEnabled(enabled)
      orchestrator.setOverseerConfig({ enabled, mode: current.mode })
      res.json({ enabled })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', port, projectDir })
  })

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

  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(port, () => {
        const actualPort = (server.address() as { port: number }).port
        _server = server
        writeStateFile(projectDir, actualPort)
        console.log(`fonagents daemon: http://localhost:${actualPort}`)
        console.log(`Project:          ${projectDir}`)
        console.log(`MCP config:       ${mcpConfigPath}`)
        console.log(`Events:           GET /api/events (SSE)`)
        resolve({ port: actualPort, mcpConfigPath, projectDir, managerRuntimeId: managerRuntime })
      })
    } catch (err) {
      reject(err)
    }
  })
}

export function stopDaemon(): void {
  if (_overseer) {
    _overseer.stop()
    _overseer = null
  }
  if (_server) {
    const s = _server
    _server = null
    s.close(() => {})
  }
  if (_projectDir) {
    removeStateFile(_projectDir)
    _projectDir = null
  }
}
