# @fonagents/taskforge-adapter

Implements `IssueTrackerPort` from `@fonagents/core` by wrapping the embedded TaskForge engine. Used by the fonagents daemon as the default issue tracker.

## Usage

```typescript
import { TaskForgeAdapter } from '@fonagents/taskforge-adapter'
import { Orchestrator } from '@fonagents/core'

const tracker = new TaskForgeAdapter({ dbPath: '.taskforge/data.db' })

// Optional: start the TaskForge HTTP server for direct API access
await tracker.startServer(3002)

// Wire into the Orchestrator
const orchestrator = new Orchestrator(tracker, runtime, eventBus, {
  projectDir: process.cwd(),
  managerRuntimeId: 'opencode',
})

// Later
await tracker.stopServer()
```

## Constructor

```typescript
new TaskForgeAdapter(config?: { dbPath?: string })
```

- `dbPath` — path to the SQLite database file (default: `:memory:`)

## Methods

All methods from `IssueTrackerPort`:

| Method | Delegates to |
|---|---|
| `listIssues(filter?)` | `forge.tasks.list()` |
| `getIssue(id)` | `forge.tasks.get()` |
| `createIssue(input)` | `forge.tasks.create()` + `forge.tasks.addDependency()` |
| `updateIssue(id, patch)` | `forge.tasks.update()` |
| `closeIssue(id, reason?)` | `forge.tasks.close()` |
| `reopenIssue(id)` | `forge.tasks.reopen()` |
| `claimIssue(id, actor?)` | `forge.tasks.claim()` |
| `addComment(id, body, actor?)` | `forge.events.create()` |
| `listComments(id)` | `forge.events.list()` + filter by `commented` |
| `listDependencies(id)` | `forge.tasks.getDependencies()` |
| `addDependency(childId, parentId)` | `forge.tasks.addDependency()` |
| `children(parentId)` | `forge.tasks.list()` with `parentId` |
| `readyWork(opts?)` | `forge.tasks.list()` filtered for open + no blockers |
| `listFormulas()` | `forge.templates.list()` |
| `showFormula(name)` | `forge.templates.get()` |
| `pourMolecule(formulaName, vars)` | `forge.templates.pour()` |
| `listMolecules()` | Returns `[]` (TaskForge doesn't track molecules) |
| `showMolecule(id)` | Returns `null` |
| `listGates(opts?)` | `forge.gates.list()` |
| `createGate(input)` | `forge.gates.create()` |
| `resolveGate(gateId)` | `forge.gates.resolve()` |
| `recordAudit(input)` | `forge.events.create()` with taskId=`'audit'` |

## Type mappings

| Fonagens | TaskForge |
|---|---|
| `IssueStatus` | `TaskStatus` (same values) |
| `IssueType` | `TaskType` (chore → task, decision → task) |
| `GateType: human/timer/gh:run/gh:pr/bead` | `GateType: human/external` |
| `GateStatus: open/closed` | `GateStatus: open/resolved` |
