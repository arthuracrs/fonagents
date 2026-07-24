# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Build & Test

```bash
npm install
npm run build
npm test           # runs all workspace tests
cd taskforge && npm test    # 141 unit tests
cd daemon && npm test       # 48 integration tests
```

## Architecture Overview

```
core/           # pure ports + domain (no external deps)
adapters/
  taskforge/    # IssueTrackerPort → TaskForge (embedded)
  anagent/      # AgentRuntimePort → anagent run
  http-sse/     # UiCommandPort + UiEventPort → Express + SSE + MCP
daemon/         # composition root — wires all adapters, serves the UI
taskforge/      # standalone task tracking engine
anagent/        # agent runner (cloned from arthuracrs/anagent at deploy)
beads-ui/       # React frontend (served by the daemon)
```

## Conventions & Patterns

- Use `fonagents_*` MCP tools for task operations, not `bd` CLI.
- Do not modify `anagent/` — it is re-cloned at deploy time.
- Run `npm run build` before committing (dist/ is checked in).
