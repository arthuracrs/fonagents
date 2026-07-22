# Overseer Module Plan

## Overview

Event-driven agent loop where worker completion events trigger overseer agent executions. The overseer reviews the board state, dispatches new workers, then exits. The cycle repeats when the next worker finishes.

## Steps for Coding Agents

Each step is self-contained with exact file paths, code to write, and verification.

---

### Step 1: Make SseEventBus extend EventEmitter

**File**: `adapters/http-sse/src/SseEventBus.ts`

**Why**: The Overseer needs to subscribe to `worker_status` events. Currently `SseEventBus` only implements `UiEventPort` (emit-only). Adding EventEmitter inheritance lets local modules (like the Overseer) subscribe to events.

**Changes**:
- Import `EventEmitter` from `events`
- Make `SseEventBus` extend `EventEmitter`
- In the `emit()` method, call `this.emit('event', event)` (local emit) in addition to broadcasting to SSE clients
- Override the `emit` name carefully to avoid recursion (rename the local emit to `emitLocal` or use a different event name)

**Implementation**:

```typescript
import type { Response } from 'express'
import type { UiEvent, UiEventPort } from '@fonagents/core'
import { EventEmitter } from 'events'

export class SseEventBus extends EventEmitter implements UiEventPort {
  private readonly clients = new Set<Response>()

  addClient(res: Response): void {
    this.clients.add(res)
  }

  removeClient(res: Response): void {
    this.clients.delete(res)
  }

  emit(event: UiEvent): void {
    // Emit to local listeners (like Overseer)
    super.emit('ui-event', event)

    // Broadcast to SSE clients
    const data = `data: ${JSON.stringify(event)}\n\n`
    for (const client of this.clients) {
      try {
        client.write(data)
        const flushable = client as unknown as { flush?: () => void }
        flushable.flush?.()
      } catch {
        this.clients.delete(client)
      }
    }
  }

  get clientCount(): number {
    return this.clients.size
  }
}
```

**Verify**: `npm run build` in the `adapters/http-sse` package. No TypeScript errors.

---

### Step 2: Add overseer prompts to the prompts package

**File**: `prompts/src/overseer-system.ts` (create new)

**Why**: The overseer agent needs a system prompt describing its tools and workflow.

**Content**:

```typescript
export const OVERSEER_SYSTEM_PROMPT = `You are a fonagents Overseer. You automatically review the board after workers complete and dispatch new work.

Available MCP tools (fonagents):

tool  | decompose
---   | ---
input | formulaName (string, required), vars (object, optional)
desc  | Decompose a request into a swarm molecule of child issues using a beads formula.

tool  | dispatchWorker
---   | ---
input | issueId (string, required), runtimeId (string, optional), prompt (string, optional)
desc  | Dispatch a one-shot coding agent onto a ready child issue.

tool  | listReady
---   | ---
input | moleculeId (string, optional)
desc  | List claimable/ready work, optionally scoped to a molecule.

tool  | workerStatus
---   | ---
input | workerId (string, optional), issueId (string, optional)
desc  | Inspect worker progress by worker id or issue id.

tool  | escalate
---   | ---
input | reason (string, required), issueId (string, optional)
desc  | Escalate to the human operator. Creates a human gate and blocks until resolved via the UI.

tool  | recordProgress
---   | ---
input | issueId (string, required), body (string, required)
desc  | Record a progress comment on an issue (audit trail).

tool  | completeIssue
---   | ---
input | issueId (string, required), reason (string, optional)
desc  | Mark an issue as complete.

Workflow:
1. Complete any done issues: use completeIssue to mark them done.
2. Check ready work: use listReady to see what is claimable.
3. Check active workers: use workerStatus to see what is running.
4. Dispatch workers on ready issues: use dispatchWorker.
5. If no ready work and no active workers, exit — the molecule is stuck or complete.

Rules:
- NEVER execute issues yourself. You are an overseer, not a worker. Always use dispatchWorker to assign work.
- Use bd show <id> --long to inspect issues when needed.
- If nothing to do, exit immediately. Do not ask questions.
`
```

**File**: `prompts/src/overseer-user.ts` (create new)

```typescript
export function buildOverseerPrompt(completedIssues: string[], failedIssues: string[]): string {
  const parts: string[] = []

  if (completedIssues.length > 0) {
    parts.push(`Workers for these issues just completed: ${completedIssues.join(', ')}`)
  }
  if (failedIssues.length > 0) {
    parts.push(`Workers for these issues failed: ${failedIssues.join(', ')}`)
  }

  parts.push('')
  parts.push('Review the board state and dispatch ready work.')

  return parts.join('\n')
}
```

**File**: `prompts/src/index.ts` (modify)

Add exports:

```typescript
export { OVERSEER_SYSTEM_PROMPT } from './overseer-system.js'
export { buildOverseerPrompt } from './overseer-user.js'
```

**Verify**: `npm run build` in the `prompts` package. No TypeScript errors.

---

### Step 3: Create the Overseer module

**File**: `daemon/src/overseer.ts` (create new)

**Why**: Core logic for event subscription, queue/batch, tmux spawning, and polling.

**Content**:

```typescript
import { EventEmitter } from 'events'
import { execFile } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'

const execFileAsync = promisify(execFile)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface OverseerConfig {
  enabled: boolean
  mode: 'queue' | 'batch'
  debounceMs: number
  maxConcurrent: number
  timeoutSec: number
}

export interface OverseerHandle {
  id: string
  sessionName: string
  status: 'running' | 'completed' | 'failed' | 'timed_out'
  startedAt: number
  finishedAt?: number
}

interface QueuedEvent {
  type: 'done' | 'failed'
  issueId: string
  workerId: string
}

export class Overseer {
  private queue: QueuedEvent[] = []
  private active: Map<string, OverseerHandle> = new Map()
  private debounceTimer: NodeJS.Timeout | null = null
  private isProcessing = false

  constructor(
    private eventBus: EventEmitter,
    private config: OverseerConfig,
    private projectDir: string,
  ) {}

  start(): void {
    if (!this.config.enabled) {
      console.log('Overseer: disabled')
      return
    }

    console.log(`Overseer: started (mode=${this.config.mode}, maxConcurrent=${this.config.maxConcurrent})`)

    this.eventBus.on('ui-event', (event: any) => {
      if (event.type === 'worker_status') {
        this.handleWorkerEvent(event)
      }
    })
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    // Kill all active overseer tmux sessions
    for (const handle of this.active.values()) {
      execFile('tmux', ['kill-session', '-t', handle.sessionName], () => {})
    }
    this.active.clear()
  }

  private handleWorkerEvent(event: any): void {
    const { workerId, status, exitCode } = event
    if (status !== 'completed' && status !== 'failed') return

    const queued: QueuedEvent = {
      type: status === 'completed' ? 'done' : 'failed',
      issueId: event.issueId || '',
      workerId,
    }

    if (this.config.mode === 'queue') {
      this.enqueue(queued)
    } else {
      this.batch(queued)
    }
  }

  // ── Queue mode ───────────────────────────────────────────────────────────────

  private enqueue(event: QueuedEvent): void {
    this.queue.push(event)
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false
      return
    }

    if (this.active.size >= this.config.maxConcurrent) {
      // At capacity — will retry when an overseer finishes
      return
    }

    this.isProcessing = true
    const event = this.queue.shift()!
    await this.runOverseer([event])
    this.processQueue()
  }

  // ── Batch mode ───────────────────────────────────────────────────────────────

  private batch(event: QueuedEvent): void {
    this.queue.push(event)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.processBatch()
    }, this.config.debounceMs)
  }

  private async processBatch(): Promise<void> {
    if (this.queue.length === 0) return
    if (this.active.size >= this.config.maxConcurrent) {
      // At capacity — events stay in queue, will process after an overseer finishes
      return
    }

    const events = [...this.queue]
    this.queue = []
    await this.runOverseer(events)
  }

  // ── Overseer spawning ────────────────────────────────────────────────────────

  private async runOverseer(events: QueuedEvent[]): Promise<void> {
    const completedIssues = events.filter(e => e.type === 'done').map(e => e.issueId).filter(Boolean)
    const failedIssues = events.filter(e => e.type === 'failed').map(e => e.issueId).filter(Boolean)

    // Build prompt
    const promptParts: string[] = []
    if (completedIssues.length > 0) {
      promptParts.push(`Workers for these issues just completed: ${completedIssues.join(', ')}`)
    }
    if (failedIssues.length > 0) {
      promptParts.push(`Workers for these issues failed: ${failedIssues.join(', ')}`)
    }
    promptParts.push('', 'Review the board state and dispatch ready work.')
    const prompt = promptParts.join('\n')

    // Create tmux session
    const id = crypto.randomBytes(6).toString('hex')
    const sessionName = `overseer-${id}`

    try {
      await execFileAsync('tmux', [
        'new-session', '-d', '-s', sessionName,
        '-x', '220', '-y', '50',
        '-c', this.projectDir,
        'opencode', '--agent', 'fonagents-overseer', '--prompt', prompt,
      ])

      // Set remain-on-exit so output stays visible for debugging
      await execFileAsync('tmux', [
        'set-option', '-t', sessionName, 'remain-on-exit', 'on',
      ]).catch(() => {})

      const handle: OverseerHandle = {
        id,
        sessionName,
        status: 'running',
        startedAt: Date.now(),
      }

      this.active.set(id, handle)
      console.log(`Overseer: spawned ${sessionName} for ${events.length} event(s)`)

      // Poll for completion (fire and forget)
      this.pollOverseer(handle)
    } catch (err) {
      console.error(`Overseer: failed to spawn ${sessionName}:`, err)
    }
  }

  private async pollOverseer(handle: OverseerHandle): Promise<void> {
    const deadline = Date.now() + this.config.timeoutSec * 1000

    while (Date.now() < deadline) {
      await sleep(5000)

      try {
        const { stdout } = await execFileAsync('tmux', [
          'display-message', '-p', '-t', handle.sessionName,
          '#{pane_dead}:#{pane_dead_status}',
        ])
        const [dead, statusStr] = stdout.trim().split(':')

        if (dead === '1') {
          handle.status = 'completed'
          handle.finishedAt = Date.now()
          this.active.delete(handle.id)
          console.log(`Overseer: ${handle.sessionName} exited (code: ${statusStr})`)
          this.onOverseerDone()
          return
        }
      } catch {
        // Session doesn't exist
        handle.status = 'completed'
        handle.finishedAt = Date.now()
        this.active.delete(handle.id)
        console.log(`Overseer: ${handle.sessionName} session gone`)
        this.onOverseerDone()
        return
      }
    }

    // Timeout
    handle.status = 'timed_out'
    handle.finishedAt = Date.now()
    console.log(`Overseer: ${handle.sessionName} timed out after ${this.config.timeoutSec}s`)
    await execFileAsync('tmux', ['kill-session', '-t', handle.sessionName]).catch(() => {})
    this.active.delete(handle.id)
    this.onOverseerDone()
  }

  private onOverseerDone(): void {
    // In queue mode, process next queued event
    if (this.config.mode === 'queue') {
      this.processQueue()
    }
    // In batch mode, process any accumulated events
    if (this.config.mode === 'batch' && this.queue.length > 0) {
      this.processBatch()
    }
  }
}
```

**Verify**: `npm run build` in the `daemon` package. No TypeScript errors.

---

### Step 4: Write the overseer agent file in cli.ts

**File**: `daemon/src/cli.ts` (modify)

**Changes**:
1. Import `OVERSEER_SYSTEM_PROMPT` from `@fonagents/prompts`
2. Add a `writeOverseerAgentFile()` function (similar to `writeAgentFile()`)
3. Call it in `runDaemon()` after writing the manager agent file

**Add import** (line 3):

```typescript
import { MANAGER_PROMPT, INITIAL_PROMPT, OVERSEER_SYSTEM_PROMPT } from '@fonagents/prompts'
```

**Add function** (after `writeAgentFile`):

```typescript
function writeOverseerAgentFile(projectDir: string, prompt: string): void {
  const agentsDir = path.join(projectDir, '.opencode', 'agents')
  fs.mkdirSync(agentsDir, { recursive: true })
  const content = `---
description: fonagents Overseer — automatically reviews board and dispatches work after workers complete
mode: primary
model: opencode-go/mimo-v2.5-pro
permission:
  task: allow
  webfetch: allow
  websearch: allow
  skill: allow
  fonagents_*: allow
---

${prompt}`
  fs.writeFileSync(path.join(agentsDir, 'fonagents-overseer.md'), content, 'utf8')
}
```

**Call in `runDaemon()`** (after line 228 `writeAgentFile`):

```typescript
writeOverseerAgentFile(projectDir, OVERSEER_SYSTEM_PROMPT)
```

**Verify**: `npm run build` in the `daemon` package. No TypeScript errors.

---

### Step 5: Wire up the Overseer in daemon.ts

**File**: `daemon/src/daemon.ts` (modify)

**Changes**:
1. Import `Overseer` and `OverseerConfig` from `./overseer.js`
2. Read env vars for config
3. Create and start the Overseer after the orchestrator
4. Stop the Overseer on daemon shutdown

**Add import**:

```typescript
import { Overseer, type OverseerConfig } from './overseer.js'
```

**Add config reading** (inside `startDaemon()`, after creating the orchestrator):

```typescript
const overseerConfig: OverseerConfig = {
  enabled: process.env.FONAGENTS_SUPERVISION_ENABLED !== 'false',
  mode: (process.env.FONAGENTS_SUPERVISION_MODE as 'queue' | 'batch') || 'queue',
  debounceMs: parseInt(process.env.FONAGENTS_SUPERVISION_DEBOUNCE_MS || '5000', 10),
  maxConcurrent: parseInt(process.env.FONAGENTS_SUPERVISION_MAX_CONCURRENT || '5', 10),
  timeoutSec: parseInt(process.env.FONAGENTS_SUPERVISION_TIMEOUT_SEC || '600', 10),
}

const overseer = new Overseer(eventBus, overseerConfig, projectDir)
overseer.start()
```

**Add cleanup** (in `stopDaemon()`):

```typescript
// Add a module-level _overseer variable and call stop()
```

To do this cleanly:
- Add `let _overseer: Overseer | null = null` at module level (near `_server`)
- Set `_overseer = overseer` after creating it
- In `stopDaemon()`, add `if (_overseer) { _overseer.stop(); _overseer = null }`

**Verify**: `npm run build` in the `daemon` package. No TypeScript errors.

---

### Step 6: Verify UiEventPort has worker_status events with issueId

**File**: `core/src/ports/UiEventPort.ts`

**Check**: The `worker_status` event type currently is:
```typescript
| { type: 'worker_status'; workerId: WorkerId; status: WorkerStatus; exitCode?: number }
```

It does NOT include `issueId`. The Overseer needs `issueId` to build the prompt.

**Change**: Add `issueId` to the `worker_status` event:

```typescript
| { type: 'worker_status'; workerId: WorkerId; issueId: IssueId; status: WorkerStatus; exitCode?: number }
```

**File**: `core/src/services/Orchestrator.ts` (modify)

Find where `worker_status` is emitted (in the `forwardWorkerEvent` method) and add `issueId` from the worker handle.

**Verify**: `npm run build` in the `core` package. No TypeScript errors.

---

### Step 7: Build and test

1. Run `npm run build` from the workspace root
2. Verify no TypeScript errors across all packages
3. Test manually:
   - Start fonagents: `fonagents`
   - Decompose a task into issues
   - Dispatch a worker
   - Watch the overseer tmux session get created when the worker finishes
   - Verify the overseer dispatches new workers or exits if nothing to do
   - Debug with `tmux attach -t overseer-xxxx`

---

## Summary of Changes

| Step | File | Action |
|------|------|--------|
| 1 | `adapters/http-sse/src/SseEventBus.ts` | Modify: extend EventEmitter |
| 2 | `prompts/src/overseer-system.ts` | Create: OVERSEER_SYSTEM_PROMPT |
| 2 | `prompts/src/overseer-user.ts` | Create: buildOverseerPrompt() |
| 2 | `prompts/src/index.ts` | Modify: add exports |
| 3 | `daemon/src/overseer.ts` | Create: Overseer class |
| 4 | `daemon/src/cli.ts` | Modify: write overseer agent file |
| 5 | `daemon/src/daemon.ts` | Modify: wire up Overseer |
| 6 | `core/src/ports/UiEventPort.ts` | Modify: add issueId to worker_status |
| 6 | `core/src/services/Orchestrator.ts` | Modify: emit issueId in worker_status |

```
Worker finishes (done/failed)
  → Orchestrator emits event
    → Overseer module receives event
      → Queue/batch logic
        → Spawns overseer agent in tmux
          → Overseer uses MCP tools (listReady, dispatchWorker, completeIssue)
          → Dispatches new workers
          → Exits
            → Next event triggers next overseer
```

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │            Overseer Module           │
                    │                                      │
  worker_done ─────►│  Queue/Batch logic                   │
  worker_failed ───►│    → spawn overseer in tmux           │
                    │    → overseer uses MCP tools          │
                    │    → dispatches new workers           │
                    │    → exits                            │
                    │    → next event triggers again        │
                    └─────────────────────────────────────┘
```

## Event Handling

| Event | Action |
|-------|--------|
| `worker_done` | Queue/batch, then spawn overseer |
| `worker_failed` | Create human gate (escalate), then queue/batch for board review |

## Concurrency Modes

### Queue (default)

- Overseer is running → push to queue
- Overseer finishes → process next queued event
- One overseer at a time, FIFO
- Ignores `MAX_CONCURRENT`, always 1

### Batch

- Worker finishes → start/reset debounce timer (default 5s)
- More workers finish → reset timer
- Timer fires → spawn one overseer for all accumulated events
- Respects `MAX_CONCURRENT` (default 5)

## Overseer Agent Lifecycle

1. Event triggers overseer
2. Daemon creates tmux session with `opencode --agent fonagents-overseer --prompt <prompt>`
3. Overseer agent has MCP tools (listReady, dispatchWorker, completeIssue, etc.)
4. Overseer calls tools to review board and dispatch work
5. Overseer exits
6. Tmux session cleaned up, next queued event processed

## Spawning Pattern

Same as workers (tmux) but using opencode directly for MCP access:

```typescript
const sessionName = `overseer-${crypto.randomBytes(6).toString('hex')}`

tmux new-session -d -s {sessionName} -x 220 -y 50 -c {projectDir} \
  opencode --agent fonagents-overseer --prompt "{prompt}"
```

- Gets MCP tools (opencode reads `.opencode/mcp.json` from project dir)
- Runs in tmux (can `tmux attach -t overseer-xxxx` to debug)
- Same timeout as workers (default 10min, configurable)

## Polling Pattern

Same as anagent's tmux polling (every 5s):

```
loop every 5s:
  check tmux pane_dead status
  if dead → clean up, process next queued event
  if timeout → kill session, clean up
```

## Termination Detection

Inside the overseer agent (prompt instructions):

1. `listReady()` — any claimable work?
2. `listWorkers()` — any active workers?
3. If both empty → exit (molecule stuck or complete)
4. If ready work → dispatch workers, exit

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `daemon/src/overseer.ts` | Create | Overseer class — event subscription, queue/batch, tmux spawning, polling |
| `prompts/src/index.ts` | Modify | Add `OVERSEER_SYSTEM_PROMPT` and `buildOverseerPrompt()` |
| `daemon/src/daemon.ts` | Modify | Initialize and wire up Overseer |
| `daemon/src/cli.ts` | Modify | Write `.opencode/agents/fonagents-overseer.md` at startup |

## Env Vars

```
FONAGENTS_SUPERVISION_ENABLED=true|false        (default: true)
FONAGENTS_SUPERVISION_MODE=queue|batch          (default: queue)
FONAGENTS_SUPERVISION_DEBOUNCE_MS=5000          (default: 5000, batch only)
FONAGENTS_SUPERVISION_MAX_CONCURRENT=5          (default: 5, batch only)
FONAGENTS_SUPERVISION_TIMEOUT_SEC=600           (default: 600, same as workers)
```

## Overseer Agent File

`.opencode/agents/fonagents-overseer.md` — written by daemon at startup:

```markdown
# System Prompt

You are an overseer agent. Workers have completed or failed on the board.

## Available Tools
- decompose: pour a beads formula into issues
- dispatchWorker: spawn a coding agent on an issue
- listReady: see claimable work
- workerStatus: check worker progress
- completeIssue: mark issue done
- escalate: create human gate
- recordProgress: audit trail

## Workflow
1. Complete any done issues: use completeIssue
2. Check ready work: use listReady
3. Check active workers: use workerStatus
4. Dispatch workers on ready issues
5. If no ready work and no active workers, exit

## Rules
- NEVER execute issues yourself
- Use `bd show <id> --long` to inspect issues
- If nothing to do, exit
```

## Prompt Builder

```typescript
export function buildOverseerPrompt(completedIssues: string[], failedIssues: string[]): string {
  let prompt = '';
  if (completedIssues.length > 0) {
    prompt += `Workers for these issues just completed: ${completedIssues.join(', ')}\n`;
  }
  if (failedIssues.length > 0) {
    prompt += `Workers for these issues failed: ${failedIssues.join(', ')}\n`;
  }
  prompt += '\nReview the board state and dispatch ready work.';
  return prompt;
}
```

## Event Flow Examples

### Happy Path

```
1. Worker for issue-1 finishes (done)
   → Overseer receives event
   → Queue: [issue-1 done]
   → !isRunning → processQueue()
   → Spawn overseer in tmux
   → Overseer: completeIssue("issue-1"), listReady() → [issue-2, issue-3]
   → Overseer: dispatchWorker("issue-2"), dispatchWorker("issue-3")
   → Overseer exits
   → activeOverseers.size--, processQueue() → empty
```

### Mixed Success/Failure

```
2. Worker for issue-2 finishes (done), Worker for issue-3 fails
   → Queue mode: process issue-2 done first
   → Spawn overseer → completeIssue("issue-2"), escalate("issue-3 failed")
   → listReady() → [issue-4]
   → dispatchWorker("issue-4"), exit
   → Process next: issue-3 failed already escalated, nothing more to do
```

### Termination

```
3. All workers done, no ready work
   → Overseer: listReady() → [], listWorkers() → []
   → Exit (molecule stuck or complete)
```

## Concurrency Handling

### Queue Mode

```
Events:  [w1-done] [w2-done] [w3-done]
          ↓
Queue:   [w1] → process immediately
         [w2, w3] → queued
          ↓
Overseer runs for w1
          ↓
Overseer exits → processQueue() → run w2
          ↓
w2 exits → processQueue() → run w3
          ↓
w3 exits → processQueue() → empty, isRunning = false
```

### Batch Mode (debounce 5s)

```
t=0s   w1-done → queue: [w1], start timer
t=1s   w2-done → queue: [w1, w2], reset timer
t=3s   w3-done → queue: [w1, w2, w3], reset timer
t=8s   timer fires → runOverseer([w1, w2, w3])
       → single overseer handles all three
```

### Max Concurrent (batch mode)

```
activeOverseers.size = 5 (max)
new event arrives
→ push to queue
→ when an overseer exits → processQueue() → spawn from queue
```

## Debugging

```bash
# List overseer tmux sessions
tmux list-sessions | grep overseer-

# Attach to a running overseer
tmux attach -t overseer-a3f1b2c4d5e6

# Check overseer logs (if captured)
# The tmux session has remain-on-exit set, so output stays visible
```
