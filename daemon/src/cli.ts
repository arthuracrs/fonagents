#!/usr/bin/env node
import { startDaemon, stopDaemon, daemonStatePath, globalRegistryPath } from './daemon.js'
import { MANAGER_PROMPT } from './manager-prompt.js'
import { spawn } from 'child_process'
import { exec } from 'child_process'
import fs from 'fs'
import net from 'net'
import path from 'path'
import readline from 'readline'
import http from 'http'

function findFreePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(start, () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolve(port))
    })
    server.on('error', () => findFreePort(start + 1).then(resolve, reject))
  })
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
      ? `start "" "${url}"`
      : `xdg-open "${url}"`
  exec(cmd)
}

function parseArgs(): { webOnly: boolean; runtime?: string; port?: number } {
  const argv = process.argv.slice(2)
  const webOnly = argv.includes('--web-only')
  const runtimeIdx = argv.indexOf('--runtime')
  const runtime = runtimeIdx >= 0 ? argv[runtimeIdx + 1] : undefined
  const portIdx = argv.indexOf('--port')
  const port = portIdx >= 0 ? parseInt(argv[portIdx + 1], 10) : undefined
  return { webOnly, runtime, port }
}

function writeAgentFile(projectDir: string, prompt: string): void {
  const agentsDir = path.join(projectDir, '.opencode', 'agents')
  fs.mkdirSync(agentsDir, { recursive: true })
  const content = `---
description: fonagents Manager — coordinates AI development through beads
mode: primary
model: glm-5.2
permission:
  task: allow
  webfetch: allow
  websearch: allow
  skill: allow
  fonagents_*: allow
---

${prompt}`
  fs.writeFileSync(path.join(agentsDir, 'fonagents-manager.md'), content, 'utf8')
}

async function readDaemonState(): Promise<{ port: number; projectDir: string } | null> {
  // 1. Check local state file first
  const statePath = daemonStatePath(process.cwd())
  if (fs.existsSync(statePath)) {
    try { return JSON.parse(fs.readFileSync(statePath, 'utf8')) } catch { /* ok */ }
  }

  // 2. Check global registry — find first live daemon
  const regPath = globalRegistryPath()
  if (!fs.existsSync(regPath)) return null
  try {
    const entries: { port: number; projectDir: string; pid: number }[] = JSON.parse(fs.readFileSync(regPath, 'utf8'))
    for (const entry of entries) {
      try {
        await fetchJson(`http://localhost:${entry.port}/api/health`)
        return entry
      } catch { /* dead daemon, skip */ }
    }
  } catch { /* ok */ }
  return null
}

async function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Invalid JSON from ${url}`)) }
      })
    }).on('error', reject)
  })
}

async function runWorkers(): Promise<void> {
  const state = await readDaemonState()
  if (!state) {
    console.error('No running fonagents daemon found.')
    console.error('Start one with: fonagents')
    process.exit(1)
  }

  let workers: any[]
  try {
    workers = (await fetchJson(`http://localhost:${state.port}/api/workers`)) as any[]
  } catch {
    console.error(`Cannot connect to daemon at localhost:${state.port}`)
    console.error('Is it still running?')
    process.exit(1)
  }

  if (workers.length === 0) {
    console.log('No workers.')
    return
  }

  console.log()
  const table: string[][] = []
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i]
    const session = w.tmuxSession ? ` tmux: ${w.tmuxSession}` : ''
    const shortId = w.id.length > 12 ? w.id.slice(0, 12) + '…' : w.id
    table.push([String(i + 1), shortId, w.issueId, w.runtimeId, w.status, session])
  }

  const colWidths = table[0].map((_, ci) => Math.max(...table.map(r => r[ci].length)))

  for (const row of table) {
    console.log('  ' + row.map((cell, ci) => cell.padEnd(colWidths[ci])).join('  '))
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>((resolve) => {
    rl.question('\nEnter number to tail, q to quit: ', resolve)
  })
  rl.close()

  if (answer === 'q') return

  const idx = parseInt(answer, 10) - 1
  if (isNaN(idx) || idx < 0 || idx >= workers.length) {
    console.log('Invalid selection.')
    return
  }

  const selected = workers[idx]
  if (!selected.tmuxSession) {
    console.log('Worker has no tmux session (headless mode). Nothing to tail.')
    return
  }

  attachTmux(selected.tmuxSession)
}

async function runTail(workerId: string): Promise<void> {
  const state = await readDaemonState()
  if (!state) {
    console.error('No running fonagents daemon found.')
    console.error('Start one with: fonagents')
    process.exit(1)
  }

  let worker: any
  try {
    worker = await fetchJson(`http://localhost:${state.port}/api/workers/${encodeURIComponent(workerId)}`)
  } catch {
    console.error(`Cannot connect to daemon at localhost:${state.port}`)
    process.exit(1)
  }

  if (!worker || (worker as any).error) {
    console.error(`Worker ${workerId} not found.`)
    process.exit(1)
  }

  if (!worker.tmuxSession) {
    console.error(`Worker ${workerId} has no tmux session (headless mode). Nothing to tail.`)
    process.exit(1)
  }

  attachTmux(worker.tmuxSession)
}

function attachTmux(session: string): void {
  console.log(`\nAttaching to tmux session: ${session}`)
  console.log('(Detach with Ctrl+B, D)\n')
  const proc = spawn('tmux', ['attach-session', '-t', session], { stdio: 'inherit' })
  proc.on('exit', () => process.exit(0))
}

async function runDaemon(): Promise<void> {
  const args = parseArgs()
  const port = await findFreePort(args.port ?? parseInt(process.env.PORT ?? '3001', 10))

  const handle = await startDaemon({ port, managerRuntimeId: args.runtime })

  const cleanup = () => { stopDaemon(); process.exit(0) }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  if (args.webOnly) {
    const url = `http://localhost:${handle.port}`
    console.log(`Opening ${url}`)
    openBrowser(url)
    return
  }

  // --- Manager mode ---
  const runtimeId = args.runtime ?? process.env.MANAGER_RUNTIME ?? handle.managerRuntimeId
  const projectDir = handle.projectDir
  const daemonUrl = `http://localhost:${handle.port}`

  console.log(`\nManager mode — starting ${runtimeId} agent...`)
  console.log(`Daemon: ${daemonUrl}  |  Project: ${projectDir}\n`)

  const managerPrompt = MANAGER_PROMPT.replace(/PORT/g, String(handle.port))
  writeAgentFile(projectDir, managerPrompt)

  const initialPrompt = 'Review the current beads and project state, then ask if the user wants to start working on ready issues.'

  const agentProc = launchAgent(runtimeId, initialPrompt, handle.mcpConfigPath, projectDir, managerPrompt)

  const onSigTerm = () => { agentProc.kill('SIGTERM') }
  process.on('SIGTERM', onSigTerm)

  const exitCode = await new Promise<number | null>((resolve) => {
    agentProc.on('exit', (code) => resolve(code))
    agentProc.on('error', () => resolve(null))
  })

  process.off('SIGTERM', onSigTerm)

  console.log(`\nAgent exited (code: ${exitCode ?? 'error'}). Shutting down...`)
  stopDaemon()
  process.exit(exitCode ?? 0)
}

function launchAgent(
  runtimeId: string,
  initialPrompt: string,
  mcpConfigPath: string,
  projectDir: string,
  systemPrompt?: string,
) {
  switch (runtimeId) {
    case 'claude-code':
      return spawn('claude', [
        '--dangerously-skip-permissions',
        ...(systemPrompt ? ['--system-prompt', systemPrompt] : []),
        '--mcp-config', mcpConfigPath,
        initialPrompt,
      ], { stdio: 'inherit', cwd: projectDir })

    case 'opencode':
    default:
      return spawn('opencode', [
        '--agent', 'fonagents-manager',
        initialPrompt,
      ], { stdio: 'inherit', cwd: projectDir })
  }
}

function printHelp(): void {
  console.log(`
Usage: fonagents [command] [options]

Commands:
  (none)              Start the daemon + manager agent
  workers             List running workers and attach to one
  tail <worker-id>    Attach directly to a worker's tmux session
  help, --help, -h    Show this help

Options:
  --web-only          Start the daemon without launching a manager agent
  --runtime <id>      Agent runtime to use (opencode, claude-code, cursor)
  --port <number>     Port for the daemon HTTP server

Examples:
  fonagents                       Start daemon + manager
  fonagents --web-only            Start daemon only (open browser)
  fonagents workers               List workers, pick one to tail
  fonagents tail m3abc12          Attach to a specific worker
`)
}

async function main() {
  const subcommand = process.argv[2]

  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printHelp()
  } else if (subcommand === 'workers') {
    await runWorkers()
  } else if (subcommand === 'tail') {
    const workerId = process.argv[3]
    if (!workerId) {
      console.error('Usage: fonagents tail <worker-id>')
      process.exit(1)
    }
    await runTail(workerId)
  } else {
    await runDaemon()
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  stopDaemon()
  process.exit(1)
})
