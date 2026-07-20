# AGENTS.md

## Installing fonagents

When installing or updating `fonagents` globally, use the GitHub archive URL, not the `github:` shorthand. npm's git dependency handler runs a `prepare` build step in a sandboxed clone where `node_modules/.bin` is not available, causing build failures.

Correct:

```bash
npm install -g https://github.com/arthurcalebe/fonagents/archive/main.tar.gz
```

To update:

```bash
npm uninstall -g fonagents && npm install -g https://github.com/arthurcalebe/fonagents/archive/main.tar.gz
```

Do not use `npm install -g github:arthurcalebe/fonagents` — it will fail during the `prepare` step.

## Releasing

Run `npm run build` locally before committing so the committed `dist/` directories are current. The archive URL install ships these prebuilt files directly — no build runs on the consumer's machine.

```bash
npm run build
git add -A
git commit -m "..."
git push
```

## No symlinks

Do not use symlinks anywhere in this project — not in postinstall, not in
build scripts, not in dependency linking. Symlinks break on Windows, can dangle,
and hide the real dependency structure. The `postinstall` script copies workspace
`dist/` directories into `node_modules/` as real files instead. If you need to
reference another workspace package, copy the files.

## anagent is external

`anagent/` is a clone of the standalone repo (`arthuracrs/anagent`). It is pulled
in at deploy time by `deploy.sh` — it is NOT developed inside fonagents.

**Do not modify anagent code inside fonagents.** Any changes made here will be
overwritten on the next deploy (the script re-clones from the anagent repo).

If anagent needs changes (new flags, runtime support, bug fixes):
1. Describe the needed change as a suggestion (issue, PR, or task comment).
2. Another person or agent implements it in the `arthuracrs/anagent` repo.
3. Once merged, `deploy.sh` pulls the updated version into fonagents.

## Deploy

Run `deploy.sh` before pushing fonagents. It clones the latest anagent from its
own repo (without `.git`), rebuilds everything, and stages the result.

```bash
./deploy.sh
git add -A
git commit -m "..."
git push
```

after deploy say to me the commands the users need to update their local fonagents

## Architecture

fonagents is a hexagonal monorepo:

```
core/           # pure ports + domain (no external deps)
adapters/
  beads/        # IssueTrackerPort → bd CLI
  anagent/      # AgentRuntimePort → anagent run
  http-sse/     # UiCommandPort + UiEventPort → Express + SSE + MCP
daemon/         # composition root — wires all adapters, serves the UI
anagent/        # external — cloned at deploy time from arthuracrs/anagent
beads-ui/       # React frontend (served by the daemon)
```

The core has zero knowledge of bd, anagent, Express, or any UI. To swap any
adapter (e.g. beads → Linear, web → terminal), implement the corresponding port.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
