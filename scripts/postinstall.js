const fs = require("fs");
const path = require("path");

const packages = [
  { name: "@fonagents/core", dir: "core" },
  { name: "@fonagents/beads-adapter", dir: "adapters/beads" },
  { name: "@fonagents/anagent-adapter", dir: "adapters/anagent" },
  { name: "@fonagents/http-sse-adapter", dir: "adapters/http-sse" },
];

for (const pkg of packages) {
  const src = path.join(__dirname, pkg.dir);
  const dest = path.join(__dirname, "node_modules", pkg.name);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.symlinkSync(src, dest);
  } catch {
    // Already exists
  }
}
