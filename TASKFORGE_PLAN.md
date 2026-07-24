# TaskForge - Custom Task Tracking System

## Executive Summary

TaskForge is a purpose-built task tracking system for multi-agent orchestration, replacing beads to address fundamental limitations in real-time updates, actor semantics, and API design.

## Problem Statement

### Current Limitations with Beads

1. **No Real-Time Events**
   - Workers bypass the backend by running `bd` commands directly
   - No webhooks or callbacks for external changes
   - Forced to add polling (5s interval) as a workaround

2. **Conflated Actor/Assignee Semantics**
   - `--actor` flag doubles as the default assignee
   - Causes bugs where issues get assigned to the wrong person
   - No separation between "who performed action" and "who is assigned"

3. **Limited API**
   - CLI-first design, not API-first
   - Limited filtering, no pagination, no sorting API
   - No rich query capabilities

4. **No Agent-Aware Concepts**
   - No native worker status tracking
   - No task claiming/lifecycle management
   - No gate/approval system

5. **Git-Coupled Storage**
   - Tied to git workflow, making it harder to use in non-git contexts
   - No offline-first with sync capabilities

## Requirements

### Core Requirements

1. **Real-Time Event System**
   - Built-in event emitter for all mutations
   - WebSocket + SSE support for live updates
   - Event history for audit trail

2. **Proper Actor Model**
   - Separate `actor` (who performed action) from `assignee` (who is responsible)
   - Actor can be human, agent, or system
   - Full audit trail of who did what, when

3. **Agent-Aware Task Lifecycle**
   - Task states: `open`, `in_progress`, `blocked`, `deferred`, `closed`
   - Claiming mechanism for workers
   - Worker status tracking (running, completed, failed)
   - Gate system for human-in-the-loop approvals

4. **Rich API**
   - REST API for CRUD operations
   - Advanced filtering (status, assignee, labels, dependencies)
   - Sorting and pagination
   - Batch operations

5. **Dependency Tracking**
   - Tasks can depend on other tasks
   - Automatic blocking/unblocking
   - Dependency graph visualization

6. **Template System**
   - Task templates (replacing beads formulas)
   - Decomposition into subtasks
   - Variable substitution

### Technical Requirements

1. **Storage**
   - SQLite for local persistence (single-file database)
   - Optional PostgreSQL for multi-user deployments
   - Efficient indexing for queries

2. **API Design**
   - RESTful endpoints
   - JSON responses
   - WebSocket for real-time updates
   - SSE fallback for older clients

3. **Deployment**
   - Embedded in fonagents daemon (default)
   - Standalone service option (future)
   - Zero external dependencies for basic usage

4. **Migration**
   - Import from beads JSONL format
   - Compatible data model where possible
   - Gradual migration path

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│                    TaskForge Core                        │
├─────────────────────────────────────────────────────────┤
│  Task Service  │  Event System  │  Actor Service       │
│  (CRUD, Query) │  (Emit, Sub)   │  (Auth, Audit)       │
├─────────────────────────────────────────────────────────┤
│  Dependency Service  │  Template Service  │  Gate Service│
│  (Graph, Blocking)   │  (Decompose)       │  (Approvals) │
├─────────────────────────────────────────────────────────┤
│              Storage Layer (SQLite/PostgreSQL)           │
└─────────────────────────────────────────────────────────┘
```

### Data Model

#### Task

```typescript
interface Task {
  id: string;                    // Unique identifier (e.g., "TF-123")
  title: string;                 // Task title
  description?: string;          // Detailed description
  status: TaskStatus;            // open | in_progress | blocked | deferred | closed
  priority: number;              // 0 (critical) - 4 (lowest)
  type: TaskType;                // bug | feature | task | epic
  assignee?: string;             // Who is responsible (actor ID)
  labels: string[];              // Tags/labels
  parentId?: string;             // Parent task (for subtasks)
  dependencies: string[];        // Task IDs this depends on
  blockedBy?: string[];          // Tasks blocking this one (computed)
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  closedAt?: string;             // ISO timestamp
  closeReason?: string;          // Why it was closed
  dueAt?: string;                // ISO timestamp
  metadata?: Record<string, any>; // Extensible metadata
}
```

#### Actor

```typescript
interface Actor {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  type: ActorType;               // human | agent | system
  email?: string;                // Contact email
  metadata?: Record<string, any>; // Extensible metadata
}
```

#### Event

```typescript
interface Event {
  id: string;                    // Unique identifier
  taskId: string;                // Related task
  actorId: string;               // Who performed the action
  type: EventType;               // created | updated | closed | commented | etc.
  payload: Record<string, any>;  // Event-specific data
  timestamp: string;             // ISO timestamp
}
```

#### Gate

```typescript
interface Gate {
  id: string;                    // Unique identifier
  taskId: string;                // Related task
  type: GateType;                // human | external
  status: GateStatus;            // open | resolved
  reason?: string;               // Why the gate was created
  awaitId?: string;              // External ID to wait for (e.g., GitHub run ID)
  createdAt: string;             // ISO timestamp
  resolvedAt?: string;           // ISO timestamp
  resolvedBy?: string;           // Actor who resolved it
}
```

#### Template

```typescript
interface Template {
  name: string;                  // Template name
  description?: string;          // Template description
  tasks: TaskTemplate[];         // Tasks to create
  variables: string[];           // Required variables
}

interface TaskTemplate {
  title: string;                 // Task title (supports {{variable}} substitution)
  description?: string;          // Task description
  type: TaskType;                // Task type
  priority: number;              // Priority
  labels: string[];              // Labels
  dependencies: string[];        // Dependencies (relative to template)
}
```

### API Design

#### REST Endpoints

```
# Tasks
GET    /api/tasks                    # List tasks (with filters)
POST   /api/tasks                    # Create task
GET    /api/tasks/:id                # Get task
PATCH  /api/tasks/:id                # Update task
DELETE /api/tasks/:id                # Delete task
POST   /api/tasks/:id/claim          # Claim task
POST   /api/tasks/:id/close          # Close task
POST   /api/tasks/:id/reopen         # Reopen task
POST   /api/tasks/:id/comment        # Add comment

# Dependencies
GET    /api/tasks/:id/deps           # Get dependencies
POST   /api/tasks/:id/deps           # Add dependency
DELETE /api/tasks/:id/deps/:depId     # Remove dependency

# Gates
GET    /api/gates                    # List gates
POST   /api/gates                    # Create gate
POST   /api/gates/:id/resolve        # Resolve gate

# Templates
GET    /api/templates                # List templates
GET    /api/templates/:name          # Get template
POST   /api/templates/:name/pour     # Instantiate template

# Events
GET    /api/events                   # Get event history
WS     /api/events/stream            # WebSocket for real-time events
```

#### Query Parameters

```
GET /api/tasks?status=open,in_progress&assignee=alice&labels=bug,urgent&sort=-createdAt&limit=50&offset=0
```

### Real-Time System

#### WebSocket Events

```typescript
type TaskEvent =
  | { type: 'task_created'; task: Task }
  | { type: 'task_updated'; task: Task; changes: Partial<Task> }
  | { type: 'task_closed'; task: Task; reason?: string }
  | { type: 'task_claimed'; task: Task; actorId: string }
  | { type: 'gate_opened'; gate: Gate }
  | { type: 'gate_resolved'; gateId: string }
  | { type: 'template_poured'; templateName: string; taskIds: string[] }
```

### Storage Layer

#### SQLite Schema

```sql
-- Tasks
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK(status IN ('open', 'in_progress', 'blocked', 'deferred', 'closed')),
  priority INTEGER NOT NULL DEFAULT 2,
  type TEXT NOT NULL CHECK(type IN ('bug', 'feature', 'task', 'epic')),
  assignee TEXT REFERENCES actors(id),
  parent_id TEXT REFERENCES tasks(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  close_reason TEXT,
  due_at TEXT,
  metadata TEXT -- JSON
);

-- Task labels (many-to-many)
CREATE TABLE task_labels (
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  PRIMARY KEY (task_id, label)
);

-- Task dependencies
CREATE TABLE task_dependencies (
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on)
);

-- Actors
CREATE TABLE actors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('human', 'agent', 'system')),
  email TEXT,
  metadata TEXT -- JSON
);

-- Events
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES actors(id),
  type TEXT NOT NULL,
  payload TEXT, -- JSON
  timestamp TEXT NOT NULL
);

-- Gates
CREATE TABLE gates (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('human', 'external')),
  status TEXT NOT NULL CHECK(status IN ('open', 'resolved')),
  reason TEXT,
  await_id TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT REFERENCES actors(id)
);

-- Templates
CREATE TABLE templates (
  name TEXT PRIMARY KEY,
  description TEXT,
  tasks TEXT NOT NULL, -- JSON array of TaskTemplate
  variables TEXT NOT NULL -- JSON array of variable names
);

-- Indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_created ON tasks(created_at);
CREATE INDEX idx_events_task ON events(task_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_gates_task ON gates(task_id);
CREATE INDEX idx_gates_status ON gates(status);
```

## Migration Strategy

### Phase 1: Build Core (Week 1-2)

**Goal**: Build the foundation with basic CRUD and events

**Deliverables**:
- [x] TaskForge core library (TypeScript)
- [x] SQLite storage layer
- [x] Basic REST API (tasks, actors, events)
- [x] Event system (in-memory + WebSocket)
- [x] Unit tests for core functionality

**Success Criteria**:
- Can create, read, update, delete tasks
- Events are emitted for all mutations
- WebSocket clients receive real-time updates

### Phase 2: Advanced Features (Week 3-4)

**Goal**: Add dependencies, templates, gates

**Deliverables**:
- [x] Dependency tracking (graph, blocking)
- [x] Template system (decomposition)
- [x] Gate system (human-in-the-loop)
- [x] Advanced queries (filtering, sorting, pagination)
- [x] Integration tests — adapter ↔ daemon (48 tests)

**Success Criteria**:
- Tasks can depend on other tasks
- Templates can be instantiated into task hierarchies
- Gates can block/unblock tasks
- Complex queries work efficiently

### Phase 3: Integration (Week 5-6)

**Goal**: Integrate with fonagents, migrate from beads

**Deliverables**:
- [x] TaskForge adapter for fonagents (implements IssueTrackerPort)
- [x] Migration tool (beads JSONL → TaskForge)
- [x] Update fonagents to use TaskForge by default
- [x] Frontend already points at daemon API — routes match
- [x] Documentation — main README, taskforge/README, adapter README

**Success Criteria**:
- fonagents can use TaskForge instead of beads
- Existing beads data can be migrated
- Frontend works with new API
- No regression in functionality

### Phase 4: Polish (Week 7-8)

**Goal**: Production readiness

**Deliverables**:
- [x] Performance optimization — SQLite indexes on status, assignee, type, priority, parent, created_at; events by task/timestamp; gates by task/status
- [ ] Error handling and recovery — middleware exists, parameterized queries prevent injection
- [x] Monitoring and logging — request logging (method, url, status, duration); health endpoint
- [x] Security review — parameterized SQL queries (no injection); input validation on createTask
- [x] User documentation — main README, taskforge/README, adapter README

**Success Criteria**:
- System handles 10k+ tasks efficiently
- Graceful degradation on errors
- Comprehensive logging for debugging
- Security vulnerabilities addressed

## Implementation Details

### Project Structure

```
taskforge/
├── core/
│   ├── src/
│   │   ├── domain/
│   │   │   ├── Task.ts
│   │   │   ├── Actor.ts
│   │   │   ├── Event.ts
│   │   │   ├── Gate.ts
│   │   │   └── Template.ts
│   │   ├── services/
│   │   │   ├── TaskService.ts
│   │   │   ├── ActorService.ts
│   │   │   ├── EventService.ts
│   │   │   ├── DependencyService.ts
│   │   │   ├── TemplateService.ts
│   │   │   └── GateService.ts
│   │   ├── ports/
│   │   │   ├── StoragePort.ts
│   │   │   └── EventBusPort.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── adapters/
│   ├── sqlite/
│   │   ├── src/
│   │   │   ├── SQLiteStorage.ts
│   │   │   ├── migrations/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── http/
│       ├── src/
│       │   ├── HttpServer.ts
│       │   ├── routes/
│       │   ├── WebSocketHandler.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── migration/
│   ├── src/
│   │   ├── BeadsImporter.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
└── package.json
```

### Key Design Decisions

1. **SQLite over PostgreSQL**
   - Simpler deployment (no external database)
   - Sufficient for local development
   - Can add PostgreSQL adapter later

2. **WebSocket over SSE**
   - Bidirectional communication
   - Better for complex interactions
   - SSE fallback for older clients

3. **Event sourcing**
   - All mutations emit events
   - Events are immutable
   - Enables audit trail and replay

4. **Actor model**
   - Separate from assignee
   - Supports humans, agents, and systems
   - Full audit trail

5. **Template system**
   - Replaces beads formulas
   - More flexible (supports variables, dependencies)
   - Can be versioned

### Technology Stack

- **Language**: TypeScript (for consistency with fonagents)
- **Runtime**: Node.js 18+
- **Database**: SQLite (via `better-sqlite3`)
- **HTTP Server**: Express (or Fastify for performance)
- **WebSocket**: `ws` library
- **Testing**: Vitest
- **Build**: TypeScript compiler

## Risks and Mitigations

### Risk 1: Migration Complexity

**Risk**: Migrating existing beads data might be complex or lossy.

**Mitigation**:
- Build a robust migration tool with dry-run mode
- Test migration on real datasets
- Keep beads adapter as fallback during transition

### Risk 2: Performance at Scale

**Risk**: SQLite might not handle large datasets efficiently.

**Mitigation**:
- Optimize queries with proper indexing
- Add pagination to all list endpoints
- Monitor performance and add PostgreSQL adapter if needed

### Risk 3: Feature Parity

**Risk**: TaskForge might not have all beads features initially.

**Mitigation**:
- Audit all beads features used by fonagents
- Prioritize features based on usage
- Keep beads adapter until feature parity is achieved

### Risk 4: Breaking Changes

**Risk**: Changing the task tracking system might break existing workflows.

**Mitigation**:
- Gradual rollout (feature flag)
- Comprehensive testing
- Rollback plan

## Success Metrics

1. **Real-Time Updates**: < 100ms latency from mutation to UI update
2. **Query Performance**: < 500ms for complex queries on 10k tasks
3. **Event Delivery**: 99.9% of events delivered to WebSocket clients
4. **Migration Success**: 100% of beads data migrated without loss
5. **User Satisfaction**: No complaints about missing features or performance

## Conclusion

TaskForge addresses the fundamental limitations of beads by providing:
- Real-time event streaming
- Proper actor/assignee semantics
- Agent-aware task lifecycle
- Rich API with advanced queries
- Extensible template system

The phased approach allows for incremental delivery and risk mitigation. The 8-week timeline is aggressive but achievable with focused effort.

**Next Steps**:
1. Review and approve this plan
2. Set up project structure
3. Begin Phase 1 implementation
4. Establish weekly review cadence
