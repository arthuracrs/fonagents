# fonagents

A manager agent that talks to you, decomposes your requests into tasks, dispatches worker agents to execute them, and escalates back to you when it needs a decision — all on top of the built-in **TaskForge** issue tracker.

You talk only to the manager. The manager talks to the workers. Workers do the coding.

```
You ──chat──→ Manager agent
                  │  decomposes into tasks (swarm molecule)
                  │  dispatches worker agents onto each task
                  │  monitors progress, escalates via human gates
                  ↓
               Worker agents ──→ your codebase
```

## Prerequisites

```bash
# Node.js 18+
node --version

# OpenCode (the agent runtime — uses your subscription)
brew install opencode
# or: npm install -g opencode

# tmux (required by anagent for agent sessions)
brew install tmux
```

## Install

```bash
npm install -g https://github.com/arthuracrs/fonagents/archive/main.tar.gz
```

To update:

```bash
npm uninstall -g fonagents && npm install -g https://github.com/arthuracrs/fonagents/archive/main.tar.gz
```

## Run

```bash
cd any-project
fonagents
```

That's it. It finds a free port, starts the server with the embedded TaskForge database (`.taskforge/`), and opens your browser.

## What you see

- **Manager** — chat with the manager agent. It decomposes your request, dispatches workers, and asks you to resolve gates when it needs a decision.
- **All Issues** — list and Kanban views with filtering, sorting, pagination
- **Ready** — issues with no open blockers, ready to work
- **Graph** — dependency graph
- **Formulas** — TaskForge workflow templates

## Configuration

| Env var | What it does |
|---|---|
| `PORT` | HTTP port (default: auto-find free port starting at 3001) |
| `PROJECT_DIR` | Path to the project (default: cwd) |
| `ANAGENT_PATH` | Path to `anagent` binary (default: auto-detect) |
| `MANAGER_RUNTIME` | Agent runtime for the manager (default: `opencode`) |
| `MANAGER_SYSTEM_PROMPT` | Override the manager's system prompt |
| `FONAGENTS_SUPERVISION_ENABLED` | Set to `false` to disable automatic worker dispatch |
| `FONAGENTS_SUPERVISION_MODE` | `queue` (default) or `batch` |

## Architecture

```
core/                       # pure ports + domain (no external deps)
adapters/
  taskforge/                # IssueTrackerPort → TaskForge (embedded)
  anagent/                  # AgentRuntimePort → anagent run
  http-sse/                 # UiCommandPort + UiEventPort → Express + SSE + MCP
taskforge/                  # standalone task tracking engine
  core/                     #   domain models, services, ports
  adapters/
    sqlite/                 #   SQLite storage adapter
    http/                   #   REST API + WebSocket server
  migration/                #   beads → TaskForge migration tool
daemon/                     # composition root — wires all adapters, serves UI
anagent/                    # agent runner (cloned from arthuracrs/anagent at deploy)
beads-ui/                   # React frontend (served by the daemon)
```

The core has zero knowledge of any adapter. To swap any adapter (e.g. SQLite → PostgreSQL, taskforge → Linear), implement the corresponding port.

### Key features

- **Real-time events** — all mutations emit events; WebSocket at `/api/events/stream`
- **Actor model** — separate `actor` (who acted) from `assignee` (who is responsible)
- **Dependency tracking** — automatic blocking/unblocking when dependencies change
- **Templates** — reusable task templates with variable substitution
- **Gates** — human-in-the-loop approvals
- **REST API** — full CRUD + filtering, sorting, pagination

## Migration from beads

If you have existing beads issues in a project, migrate them to TaskForge:

```bash
cd your-beads-project
fonagents migrate
```

This reads all beads issues via `bd list`, imports them into the TaskForge
SQLite database (`.taskforge/data.db`), and preserves assignees, labels,
dependencies, and parent-child relationships.

After migration, run `fonagents` normally — it uses TaskForge by default.

## Development

```bash
git clone https://github.com/arthuracrs/fonagents
cd fonagents
npm install
npm run build
npm test
```

### Project structure

```bash
taskforge/          # standalone task tracking engine
  npm test          # 141 unit tests (core + SQLite + HTTP)
daemon/             # composition root
  npm test          # 48 integration tests (adapter + HTTP API)
```

## License

ISC
