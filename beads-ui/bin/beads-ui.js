#!/usr/bin/env node
// beads-ui is now a thin wrapper around the fonagents daemon.
// The daemon serves the React UI (from beads-ui/dist) + the API + SSE events.
const { spawn } = require("child_process");
const path = require("path");

const daemonCli = path.join(__dirname, "../../daemon/dist/cli.js");

const proc = spawn("node", [daemonCli], {
  env: process.env,
  stdio: "inherit",
});

proc.on("error", (err) => {
  console.error("Failed to start daemon:", err.message);
  console.error("Make sure you've run `npm run build` from the monorepo root.");
  process.exit(1);
});

proc.on("exit", (code) => process.exit(code ?? 0));
