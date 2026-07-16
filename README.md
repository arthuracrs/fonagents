# fonagents

A manager agent that talks to you, decomposes your requests into tasks, dispatches worker agents to execute them, and escalates back to you when it needs a decision — all on top of the [Beads](https://github.com/gastownhall/beads) issue tracker.

You talk only to the manager. The manager talks to the workers. Workers do the coding.

```
You ──chat──→ Manager agent
                 │  decomposes into Beads issues (swarm molecule)
                 │  dispatches worker agents onto each issue
                 │  monitors progress, escalates via human gates
                 ↓
              Worker agents ──→ your codebase
```

## Prerequisites

Install these first:

```bash
# Node.js 18+
node --version

# Beads (issue tracker)
brew install beads

# OpenCode (the agent runtime — uses your subscription)
brew install opencode
# or: npm install -g opencode

# tmux (required by anagent for agent sessions)
brew install tmux
```

Then initialize Beads in your project:

```bash
cd your-project
bd init
```

## Install

```bash
npm install -g https://github.com/arthuracrs/fonagents/archive/main.tar.gz
```

To update:

```bash
npm uninstall -g fonagents && npm install -g https://github.com/arthuracrs/fonagents/archive/main.tar.gz
```

Do not use `npm install -g github:arthuracrs/fonagents` — it fails during the build step.

## Run

```bash
cd any-beads-project
fonagents
```

That's it. It finds a free port, starts the server, and opens your browser.

## What you see

- **Manager** — chat with the manager agent. It decomposes your request, dispatches workers, and asks you to resolve gates when it needs a decision.
- **All Issues** — list and Kanban views with filtering
- **Ready** — issues with no open blockers, ready to work
- **Graph** — dependency graph
- **Formulas** — Beads workflow formulas

## Configuration

| Env var | What it does |
|---|---|
| `PORT` | HTTP port (default: auto-find free port starting at 3001) |
| `PROJECT_DIR` | Path to the project with `.beads/` (default: cwd) |
| `BD_PATH` | Path to `bd` binary (default: auto-detect) |
| `ANAGENT_PATH` | Path to `anagent` binary (default: auto-detect) |
| `MANAGER_RUNTIME` | Agent runtime for the manager (default: `opencode`) |
| `MANAGER_SYSTEM_PROMPT` | Override the manager's system prompt |

## Architecture

```
core/           # pure ports + domain (no external deps)
adapters/
  beads/        # IssueTrackerPort → bd CLI
  anagent/      # AgentRuntimePort → anagent run
  http-sse/     # UiCommandPort + UiEventPort → Express + SSE + MCP
daemon/         # composition root — wires all adapters, serves the UI
anagent/        # agent runner (cloned from arthuracrs/anagent at deploy)
beads-ui/       # React frontend (served by the daemon)
```

The core has zero knowledge of bd, anagent, Express, or any UI. To swap any
adapter (e.g. beads → Linear, web → terminal, opencode → claude-code), implement
the corresponding port.

## License

ISC
