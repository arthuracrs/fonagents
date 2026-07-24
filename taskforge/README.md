# TaskForge

Embeddable task tracking engine with real-time events, dependency management, templates, and gates. Used as the default issue tracker by fonagents.

## Quick start

```typescript
import { TaskForge } from 'taskforge'

const forge = new TaskForge() // in-memory SQLite

// Create a task
const task = await forge.tasks.create({ title: 'My task' })

// List with filters
await forge.tasks.list({ status: 'open' })

// Start HTTP server (optional)
await forge.start(3002)
```

## API

### TaskService (`forge.tasks`)

| Method | Description |
|---|---|
| `list(filter?)` | List tasks with filtering, sorting, pagination |
| `get(id)` | Get a single task |
| `create(input)` | Create a task |
| `update(id, patch)` | Update task fields |
| `claim(id, actorId)` | Assign and set status to `in_progress` |
| `close(id, reason?)` | Close a task |
| `reopen(id)` | Reopen a closed task |
| `addDependency(taskId, dependsOn)` | Add a dependency |
| `removeDependency(taskId, dependsOn)` | Remove a dependency |
| `getDependencies(id)` | Get dependency tasks |
| `getBlocked()` | Get all blocked tasks |

#### List filters

```typescript
await forge.tasks.list({
  status: 'open',
  assignee: 'user-1',
  type: 'bug',
  labels: ['urgent'],
  parentId: 'task-1',
  priority: 1,
  sort: [{ field: 'priority', direction: 'asc' }],
  limit: 20,
  offset: 0,
})
```

### ActorService (`forge.actors`)

| Method | Description |
|---|---|
| `list()` | List all actors |
| `get(id)` | Get an actor |
| `create(input)` | Create an actor |

### EventService (`forge.events`)

| Method | Description |
|---|---|
| `list(taskId?)` | List events (optionally filtered by task) |
| `create(taskId, actorId, type, payload)` | Create an event |

### GateService (`forge.gates`)

| Method | Description |
|---|---|
| `list(taskId?)` | List gates |
| `get(id)` | Get a gate |
| `create(taskId, type, reason?, awaitId?)` | Create a gate |
| `resolve(id, resolvedBy)` | Resolve a gate |

### TemplateService (`forge.templates`)

| Method | Description |
|---|---|
| `list()` | List templates |
| `get(name)` | Get a template |
| `create(input)` | Create a template |
| `delete(name)` | Delete a template |
| `pour(name, vars)` | Instantiate a template (creates tasks with variable substitution) |

## HTTP API

When the HTTP server is started, these endpoints are available:

```
GET    /api/tasks                    # List tasks (?status=open&sort=priority:asc&limit=10&offset=0)
POST   /api/tasks                    # Create task
GET    /api/tasks/:id                # Get task
PATCH  /api/tasks/:id                # Update task
DELETE /api/tasks/:id                # Delete task
POST   /api/tasks/:id/claim          # Claim task
POST   /api/tasks/:id/close          # Close task
POST   /api/tasks/:id/reopen         # Reopen task
POST   /api/tasks/:id/comment        # Add comment

GET    /api/actors                   # List actors
POST   /api/actors                   # Create actor

GET    /api/events                   # List events (?taskId=xxx)
WS     /api/events/stream            # WebSocket for real-time events

GET    /api/gates                    # List gates
POST   /api/gates                    # Create gate
POST   /api/gates/:id/resolve        # Resolve gate

GET    /api/templates                # List templates
GET    /api/templates/:name          # Get template
POST   /api/templates                # Create template
POST   /api/templates/:name/pour     # Pour template
DELETE /api/templates/:name          # Delete template
```

## Types

### Task

```typescript
interface Task {
  id: string
  title: string
  description?: string
  status: 'open' | 'in_progress' | 'blocked' | 'deferred' | 'closed'
  priority: 0 | 1 | 2 | 3 | 4
  type: 'bug' | 'feature' | 'task' | 'epic'
  assignee?: string
  labels: string[]
  parentId?: string
  dependencies: string[]
  createdAt: string
  updatedAt: string
  closedAt?: string
  closeReason?: string
  dueAt?: string
  metadata?: Record<string, unknown>
}
```

### TaskFilter

```typescript
interface TaskFilter {
  status?: TaskStatus
  assignee?: string
  labels?: string[]
  type?: TaskType
  parentId?: string
  priority?: 0 | 1 | 2 | 3 | 4
  sort?: { field: string; direction?: 'asc' | 'desc' }[]
  limit?: number
  offset?: number
}
```

## Events

All mutations emit typed events:

```typescript
type TaskEvent =
  | { type: 'task_created'; task: Task }
  | { type: 'task_updated'; task: Task; changes: Partial<Task> }
  | { type: 'task_closed'; task: Task; reason?: string }
  | { type: 'task_reopened'; task: Task }
  | { type: 'task_claimed'; task: Task; actorId: string }
  | { type: 'comment_added'; taskId: string; comment: Event }
  | { type: 'gate_opened'; gate: Gate }
  | { type: 'gate_resolved'; gateId: string }
```

## Storage

Default storage is SQLite via better-sqlite3. Pass `dbPath` to persist:

```typescript
const forge = new TaskForge({ dbPath: '/path/to/data.db' })
```

## Development

```bash
npm test          # 141 unit tests
npm run build     # compile TypeScript
```

## Project structure

```
taskforge/
├── core/               # domain models, services, ports
│   ├── src/domain/     # Task, Actor, Event, Gate, Template interfaces
│   ├── src/ports/      # StoragePort, EventBusPort interfaces
│   ├── src/services/   # TaskService, ActorService, EventService, GateService, TemplateService
│   └── src/__tests__/  # unit tests (vitest)
├── adapters/
│   ├── sqlite/         # SQLiteStorage implementing StoragePort
│   └── http/           # HttpServer with REST API + WebSocket
├── migration/          # beads → TaskForge migration tool
└── dist/               # compiled output
```
