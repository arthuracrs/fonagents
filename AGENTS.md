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
