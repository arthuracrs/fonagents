#!/usr/bin/env node
import { startDaemon, stopDaemon } from './daemon.js'
import { MANAGER_PROMPT } from './manager-prompt.js'
import { spawn } from 'child_process'
import { exec } from 'child_process'
import fs from 'fs'
import net from 'net'
import path from 'path'

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

async function main() {
  const args = parseArgs()
  const port = await findFreePort(args.port ?? parseInt(process.env.PORT ?? '3001', 10))

  const handle = await startDaemon({ port, managerRuntimeId: args.runtime })

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

  const prompt = MANAGER_PROMPT.replace(/PORT/g, String(handle.port))
  writeAgentFile(projectDir, prompt)

  const agentProc = launchAgent(runtimeId, prompt, handle.mcpConfigPath, projectDir)

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
  prompt: string,
  mcpConfigPath: string,
  projectDir: string,
) {
  switch (runtimeId) {
    case 'claude-code':
      return spawn('claude', [
        '--dangerously-skip-permissions',
        '--system-prompt', prompt,
        '--mcp-config', mcpConfigPath,
      ], { stdio: 'inherit', cwd: projectDir })

    case 'opencode':
    default:
      return spawn('opencode', [
        '--agent', 'fonagents-manager',
      ], { stdio: 'inherit', cwd: projectDir })
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  stopDaemon()
  process.exit(1)
})
