import express, { type Express, type Request, type Response } from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import type {
  IssueCreateInput,
  IssueFilter,
  IssueUpdatePatch,
  ManagerToolsPort,
  UiCommandPort,
} from '@fonagents/core'
import { SseEventBus } from './SseEventBus.js'

export interface HttpSseAdapterConfig {
  port: number
  projectDir: string
  mcpServerScriptPath?: string
}

// Creates an Express app that:
//   1. Exposes UiCommandPort methods as HTTP endpoints (UIs drive core)
//   2. Exposes UiEventPort as an SSE fanout (core emits to all connected UIs)
//   3. Exposes ManagerToolsPort methods as HTTP endpoints (MCP server calls these)
//
// The eventBus and mcpConfigPath are created OUTSIDE and passed in, so the
// Orchestrator can be constructed with them before the Express routes are wired.
// This breaks the circular dependency: Orchestrator needs mcpConfigPath →
// createHttpSseApp needs Orchestrator for route handlers.
export function createHttpSseApp(
  command: UiCommandPort,
  managerTools: ManagerToolsPort,
  eventBus: SseEventBus,
  config: HttpSseAdapterConfig,
): { app: Express } {
  const app = express()
  app.use(cors())
  app.use(express.json())

  // Wrap async handlers with uniform error handling so bd/anagent failures
  // return a clean 500 JSON instead of a raw Express stack trace.
  const wrap = (fn: (req: Request, res: Response) => Promise<void>): (req: Request, res: Response) => Promise<void> =>
    async (req, res) => {
      try {
        await fn(req, res)
      } catch (err) {
        const e = err as { stderr?: string; message: string }
        if (!res.headersSent) res.status(500).json({ error: e.stderr || e.message })
      }
    }

  // Express 5 types req.params as string | string[]; extract the string.
  const param = (req: Request, key: string): string => {
    const v = req.params[key]
    return Array.isArray(v) ? v[0] : v
  }

  // ── SSE event stream ──────────────────────────────────────────────────────
  // UIs connect here and receive all UiEvent broadcasts in real time.
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()
    res.socket?.setNoDelay(true)
    eventBus.addClient(res)
    req.on('close', () => eventBus.removeClient(res))
  })

  // ── Init status (frontend checks this on startup) ───────────────────────────
  app.get('/api/init-status', wrap(async (_req, res) => {
    const bdPath = process.env.BD_PATH ?? 'bd'
    const initialized = fs.existsSync(path.join(config.projectDir, '.beads'))
    res.json({ initialized })
  }))

  app.post('/api/init', wrap(async (req, res) => {
    const dir = (req.body as { dir?: string })?.dir ?? config.projectDir
    const bdPath = process.env.BD_PATH ?? 'bd'
    const { execFile } = require('child_process')
    const { promisify } = require('util')
    const execFileAsync = promisify(execFile)
    const { stdout } = await execFileAsync(bdPath, ['init'], { cwd: dir })
    res.json({ ok: true, output: stdout })
  }))

  // ── Conversation ────────────────────────────────────────────────────────────
  app.post('/api/message', wrap(async (req, res) => {
    const { content } = req.body as { content: string }
    if (!content) { res.status(400).json({ error: 'content is required' }); return }
    const result = await command.sendUserMessage(content)
    res.json(result)
  }))

  // ── Manager lifecycle ───────────────────────────────────────────────────────
  app.post('/api/manager/start', wrap(async (_req, res) => {
    res.json(await command.startManager())
  }))

  app.post('/api/manager/end', wrap(async (_req, res) => {
    await command.endManager()
    res.json({ ok: true })
  }))

  // ── Gates ───────────────────────────────────────────────────────────────────
  app.post('/api/gates/:id/resolve', wrap(async (req, res) => {
    const { note } = req.body as { note?: string }
    await command.resolveGate(param(req, 'id'), note)
    res.json({ ok: true })
  }))

  // ── Worker control ──────────────────────────────────────────────────────────
  app.post('/api/workers/:id/cancel', wrap(async (req, res) => {
    await command.cancelWorker(param(req, "id"))
    res.json({ ok: true })
  }))

  // ── Issue queries ───────────────────────────────────────────────────────────
  app.get('/api/issues', wrap(async (req, res) => {
    const filter: IssueFilter = {}
    const { status, type, priority, assignee, parent } = req.query
    if (status) filter.status = status as string
    if (type) filter.type = type as string
    if (priority !== undefined) filter.priority = Number(priority)
    if (assignee) filter.assignee = assignee as string
    if (parent) filter.parent = parent as string
    res.json(await command.listIssues(filter))
  }))

  // ── Stats (must be before /:id to avoid matching "stats" as an issue ID) ────
  app.get('/api/issues/stats', wrap(async (_req, res) => {
    const issues = await command.listIssues()
    const summary = {
      total_issues: issues.length,
      open_issues: issues.filter((i) => i.status === 'open').length,
      in_progress_issues: issues.filter((i) => i.status === 'in_progress').length,
      blocked_issues: issues.filter((i) => i.status === 'blocked').length,
      closed_issues: issues.filter((i) => i.status === 'closed').length,
      deferred_issues: issues.filter((i) => i.status === 'deferred').length,
    }
    res.json({ summary })
  }))

  app.get('/api/issues/:id', wrap(async (req, res) => {
    const issue = await command.getIssue(param(req, "id"))
    if (!issue) { res.status(404).json({ error: 'Not found' }); return }
    res.json(issue)
  }))

  // ── Issue CRUD ──────────────────────────────────────────────────────────────
  app.post('/api/issues', wrap(async (req, res) => {
    const input = req.body as IssueCreateInput
    if (!input.title) { res.status(400).json({ error: 'title is required' }); return }
    res.json(await command.createIssue(input))
  }))

  app.patch('/api/issues/:id', wrap(async (req, res) => {
    const patch = req.body as IssueUpdatePatch
    res.json(await command.updateIssue(param(req, "id"), patch))
  }))

  app.post('/api/issues/:id/close', wrap(async (req, res) => {
    const { reason } = req.body as { reason?: string }
    res.json(await command.closeIssue(param(req, "id"), reason))
  }))

  app.post('/api/issues/:id/reopen', wrap(async (req, res) => {
    res.json(await command.reopenIssue(param(req, "id")))
  }))

  app.post('/api/issues/:id/claim', wrap(async (req, res) => {
    res.json(await command.claimIssue(param(req, "id")))
  }))

  app.post('/api/issues/:id/comment', wrap(async (req, res) => {
    const { body } = req.body as { body: string }
    if (!body) { res.status(400).json({ error: 'body is required' }); return }
    res.json(await command.addComment(param(req, "id"), body))
  }))

  app.get('/api/issues/:id/comments', wrap(async (req, res) => {
    res.json(await command.listComments(param(req, "id")))
  }))

  app.get('/api/issues/:id/deps', wrap(async (req, res) => {
    res.json(await command.listDependencies(param(req, "id")))
  }))

  app.post('/api/deps', wrap(async (req, res) => {
    const { child, parent, type } = req.body as { child: string; parent: string; type?: string }
    await command.addDependency(child, parent, type)
    res.json({ ok: true })
  }))

  app.get('/api/issues/:id/children', wrap(async (req, res) => {
    res.json(await command.children(param(req, "id")))
  }))

  // ── Molecules & formulas ─────────────────────────────────────────────────────
  app.get('/api/molecules', wrap(async (_req, res) => {
    res.json(await command.listMolecules())
  }))

  app.get('/api/molecules/:id', wrap(async (req, res) => {
    res.json(await command.showMolecule(param(req, "id")))
  }))

  app.get('/api/formulas', wrap(async (_req, res) => {
    res.json(await command.listFormulas())
  }))

  // ── Ready work & gates ──────────────────────────────────────────────────────
  app.get('/api/ready', wrap(async (_req, res) => {
    res.json(await command.listReadyWork())
  }))

  app.get('/api/gates', wrap(async (_req, res) => {
    res.json(await command.listGates())
  }))

  // ── Graph (frontend dependency view) ─────────────────────────────────────────
  app.get('/api/graph', wrap(async (_req, res) => {
    const issues = await command.listIssues()
    res.json({ issues })
  }))

  // ── Legacy execution endpoints (frontend AgentsPanel) ────────────────────────
  // These bridge the old beads-ui components to the new architecture.
  app.get('/api/executions/issue/:issueId', wrap(async (req, res) => {
    res.json([])
  }))

  app.post('/api/executions', wrap(async (req, res) => {
    const { issueId, runtimeId, prompt, mode } = req.body as {
      issueId: string; runtimeId: string; prompt: string; mode?: string
    }
    // Dispatch via the manager tools (same as dispatchWorker)
    const result = await managerTools.dispatchWorker({ issueId, runtimeId, prompt })
    res.json({ id: result.workerId, issueId, status: 'running', startedAt: new Date().toISOString() })
  }))

  app.delete('/api/executions/:id', wrap(async (req, res) => {
    await command.cancelWorker(param(req, 'id'))
    res.json({ ok: true })
  }))

  // ── Legacy trigger endpoints (frontend AgentsPanel) ──────────────────────────
  app.get('/api/triggers/issue/:issueId', wrap(async (_req, res) => {
    res.json([])
  }))

  app.post('/api/triggers', wrap(async (_req, res) => {
    res.json({ id: Date.now().toString(), enabled: true, createdAt: new Date().toISOString() })
  }))

  app.patch('/api/triggers/:id', wrap(async (_req, res) => {
    res.json({ ok: true })
  }))

  app.delete('/api/triggers/:id', wrap(async (_req, res) => {
    res.json({ ok: true })
  }))

  // ── Workers & runtimes ──────────────────────────────────────────────────────
  app.get('/api/workers/:id', wrap(async (req, res) => {
    const worker = await command.getWorkerStatus(param(req, "id"))
    if (!worker) { res.status(404).json({ error: 'Not found' }); return }
    res.json(worker)
  }))

  app.get('/api/runtimes', wrap(async (_req, res) => {
    res.json(await command.listRuntimes())
  }))

  // ── Messages ────────────────────────────────────────────────────────────────
  app.get('/api/messages', wrap(async (_req, res) => {
    res.json(await command.listMessages())
  }))

  // ── MCP tool endpoint (called by the MCP server script) ──────────────────────
  app.post('/api/mcp/tools/:name', wrap(async (req, res) => {
    const toolName = param(req, "name")
    const args = req.body as Record<string, unknown>
    const result = await executeManagerTool(managerTools, toolName, args)
    res.json(result)
  }))

  return { app }
}

// Dispatches an MCP tool call to the corresponding ManagerToolsPort method.
async function executeManagerTool(
  tools: ManagerToolsPort,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'decompose':
      return tools.decompose(args as { formulaName: string; vars: Record<string, string> })
    case 'dispatchWorker':
      return tools.dispatchWorker(args as { issueId: string; runtimeId?: string; prompt?: string })
    case 'listReady':
      return tools.listReady(args as { moleculeId?: string })
    case 'workerStatus':
      return tools.workerStatus(args as { workerId?: string; issueId?: string })
    case 'escalate':
      return tools.escalate(args as { reason: string; issueId?: string })
    case 'recordProgress':
      return tools.recordProgress(args as { issueId: string; body: string })
    case 'completeIssue':
      return tools.completeIssue(args as { issueId: string; reason?: string })
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
