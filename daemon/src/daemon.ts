import { Orchestrator } from '@fonagents/core'
import type { OrchestratorConfig } from '@fonagents/core'
import { BeadsAdapter } from '@fonagents/beads-adapter'
import { AnagentAdapter } from '@fonagents/anagent-adapter'
import { createHttpSseApp, SseEventBus, writeMcpConfig, type McpConfigFormat } from '@fonagents/http-sse-adapter'
import express from 'express'
import type { Express } from 'express'
import path from 'path'
import fs from 'fs'

// __dirname is injected by esbuild's banner so it points to the real file
// location, regardless of npm's bin symlink. See daemon/package.json build script.

// Default manager system prompt — teaches the manager about its tools and the
// beads workflow. Can be overridden via MANAGER_SYSTEM_PROMPT env var or
// MANAGER_PROMPT_FILE path.
const DEFAULT_MANAGER_PROMPT = [
  'You are the manager agent for a software project tracked by Beads (bd).',
  'The human operator talks only to you. You are responsible for:',
  '',
  '1. DECOMPOSITION: When the human gives you a task, use the `decompose` tool',
  '   to pour a swarm molecule. This creates child issues you can dispatch workers onto.',
  '2. DISPATCH: Use `dispatchWorker` to send a coding agent onto each ready child issue.',
  '   Workers run autonomously in headless mode and report back through you.',
  '3. MONITORING: Use `workerStatus` to check on dispatched workers. Use `listReady`',
  '   to find the next claimable step.',
  '4. COMPLETION: When a worker finishes, use `completeIssue` to close its issue.',
  '   Use `recordProgress` to document what happened.',
  '5. ESCALATION: When you need a human decision, use `escalate`. This creates a gate',
  '   that blocks until the human resolves it in the UI. Use this for:',
  '   - Ambiguous requirements',
  '   - Architecture decisions',
  '   - When all workers are stuck',
  '',
  'IMPORTANT: Always use the provided tools. Do NOT shell out to bd or try to spawn',
  'agents directly — the system handles that for you and records everything.',
].join('\n')

export interface DaemonConfig {
  port?: number
  projectDir?: string
  bdPath?: string
  anagentPath?: string
  managerRuntimeId?: string
  managerSystemPrompt?: string
  managerPromptFile?: string
}

export function startDaemon(opts: DaemonConfig = {}): void {
  const projectDir = opts.projectDir ?? process.env.PROJECT_DIR ?? process.cwd()
  const port = opts.port ?? parseInt(process.env.PORT ?? '3001', 10)

  // ── 1. Create the event bus (UiEventPort) ───────────────────────────────────
  const eventBus = new SseEventBus()

  // ── 2. Write the MCP config (so the manager can call core's tools) ──────────
  // The config format depends on the runtime: claude-code uses a JSON file
  // passed via --mcp-config; opencode uses a .opencode/opencode.json file
  // discovered from the cwd.
  const managerRuntime = opts.managerRuntimeId ?? process.env.MANAGER_RUNTIME ?? 'opencode'
  const mcpFormat: McpConfigFormat = managerRuntime === 'claude-code' ? 'claude-code' : 'opencode'
  const pkgRoot = path.resolve(__dirname, '../..')
  const mcpServerScript = path.join(pkgRoot, 'adapters/http-sse/dist/mcp-server.js')
  const mcpConfigPath = writeMcpConfig({
    daemonUrl: `http://localhost:${port}`,
    mcpServerScript,
    format: mcpFormat,
  })

  // For opencode, copy the .opencode/ config into the project dir so opencode
  // discovers it when launched with --cwd <projectDir>.
  if (mcpFormat === 'opencode') {
    const projectOpencodeDir = path.join(projectDir, '.opencode')
    fs.mkdirSync(projectOpencodeDir, { recursive: true })
    const destConfig = path.join(projectOpencodeDir, 'opencode.json')
    const srcConfig = path.join(path.dirname(mcpConfigPath), 'opencode.json')
    // Merge with existing config if present, otherwise just copy
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

  // ── 3. Create the adapters (the hexagon's outside) ──────────────────────────
  const tracker = new BeadsAdapter({
    bdPath: opts.bdPath ?? process.env.BD_PATH,
    projectDir,
    actor: process.env.BEADS_ACTOR,
  })

  const runtime = new AnagentAdapter({
    anagentPath: opts.anagentPath ?? process.env.ANAGENT_PATH,
    cwd: projectDir,
  })

  // ── 4. Resolve the manager system prompt ─────────────────────────────────────
  const managerSystemPrompt = opts.managerSystemPrompt
    ?? (opts.managerPromptFile
      ? fs.readFileSync(opts.managerPromptFile, 'utf8')
      : process.env.MANAGER_SYSTEM_PROMPT
      ?? DEFAULT_MANAGER_PROMPT)

  // ── 5. Create the Orchestrator (the hexagon's inside) ────────────────────────
  const orchestratorConfig: OrchestratorConfig = {
    projectDir,
    managerRuntimeId: managerRuntime,
    managerSystemPrompt,
    mcpConfigPath,
  }

  const orchestrator = new Orchestrator(tracker, runtime, eventBus, orchestratorConfig)

  // ── 6. Create the Express app (wire routes to the orchestrator) ──────────────
  const { app } = createHttpSseApp(orchestrator, orchestrator, eventBus, { port, projectDir })

  // ── 7. Serve the web UI if beads-ui's dist exists ────────────────────────────
  const beadsUiDist = path.join(pkgRoot, 'beads-ui/dist')
  if (fs.existsSync(beadsUiDist)) {
    app.use(express.static(beadsUiDist))
    app.get('/*path', (_req, res) => {
      res.sendFile(path.join(beadsUiDist, 'index.html'))
    })
  }

  // ── 8. Start ──────────────────────────────────────────────────────────────────
  const server = app.listen(port, () => {
    console.log(`fonagents daemon: http://localhost:${port}`)
    console.log(`Project:          ${projectDir}`)
    console.log(`MCP config:       ${mcpConfigPath}`)
    console.log(`Events:           GET /api/events (SSE)`)
    console.log(`Message:          POST /api/message`)
  })

  // ── 9. Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async () => {
    console.log('\nShutting down...')
    try { await orchestrator.endManager() } catch { /* ok */ }
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 5000).unref()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
