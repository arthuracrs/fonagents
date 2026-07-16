"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeMcpConfig = writeMcpConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
// Writes the MCP server config file in the format the target runtime expects.
//   claude-code: { mcpServers: { fonagents: { command, args } } } — passed via --mcp-config
//   opencode:    { mcp: { fonagents: { type: "local", command: [...] } } } — loaded from ~/.config/opencode/ or project .opencode/
function writeMcpConfig(opts) {
    const command = ['node', opts.mcpServerScript, '--daemon-url', opts.daemonUrl];
    if (opts.format === 'opencode') {
        return writeOpencodeConfig(command);
    }
    return writeClaudeCodeConfig(command);
}
function writeClaudeCodeConfig(command) {
    const config = {
        mcpServers: {
            fonagents: {
                command: command[0],
                args: command.slice(1),
            },
        },
    };
    const dir = path_1.default.join(os_1.default.tmpdir(), 'fonagents');
    fs_1.default.mkdirSync(dir, { recursive: true });
    const configPath = path_1.default.join(dir, 'mcp-config.json');
    fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return configPath;
}
function writeOpencodeConfig(command) {
    // Write to a project-local .opencode/opencode.json so opencode picks it up.
    // We write to a temp project config dir and set it as the cwd for the agent,
    // or we can write to the user config. Project-local is cleaner — it doesn't
    // pollute the user's global config and it's automatically discovered.
    const dir = path_1.default.join(os_1.default.tmpdir(), 'fonagents');
    fs_1.default.mkdirSync(dir, { recursive: true });
    // opencode loads config from .opencode/opencode.json in the cwd.
    // We write a standalone config that the daemon will symlink or copy into
    // the project's .opencode/ directory. For now, write to the temp dir and
    // the daemon will handle placement.
    const opencodeDir = path_1.default.join(dir, '.opencode');
    fs_1.default.mkdirSync(opencodeDir, { recursive: true });
    const configPath = path_1.default.join(opencodeDir, 'opencode.json');
    const config = {
        $schema: 'https://opencode.ai/config.json',
        mcp: {
            fonagents: {
                type: 'local',
                command,
            },
        },
    };
    fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return configPath;
}
//# sourceMappingURL=McpConfigWriter.js.map