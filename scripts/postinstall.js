const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const packages = [
  { name: "@fonagents/core", dir: "core" },
  { name: "@fonagents/beads-adapter", dir: "adapters/beads" },
  { name: "@fonagents/anagent-adapter", dir: "adapters/anagent" },
  { name: "@fonagents/http-sse-adapter", dir: "adapters/http-sse" },
];

for (const pkg of packages) {
  const src = path.join(root, pkg.dir);
  const dest = path.join(root, "node_modules", pkg.name);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  copyDir(src, dest);
}
