import fs from 'fs'
import path from 'path'
import os from 'os'

export type McpConfigFormat = 'claude-code' | 'opencode'

export interface WriteMcpConfigOpts {
  daemonUrl: string
  mcpServerScript: string
  format: McpConfigFormat
}

// Writes the MCP server config file in the format the target runtime expects.
//   claude-code: { mcpServers: { fonagents: { command, args } } } — passed via --mcp-config
//   opencode:    { mcp: { fonagents: { type: "local", command: [...] } } } — loaded from ~/.config/opencode/ or project .opencode/
export function writeMcpConfig(opts: WriteMcpConfigOpts): string {
  const command = ['node', opts.mcpServerScript, '--daemon-url', opts.daemonUrl]

  if (opts.format === 'opencode') {
    return writeOpencodeConfig(command)
  }

  return writeClaudeCodeConfig(command)
}

function writeClaudeCodeConfig(command: string[]): string {
  const config = {
    mcpServers: {
      fonagents: {
        command: command[0],
        args: command.slice(1),
      },
    },
  }
  const dir = path.join(os.tmpdir(), 'fonagents')
  fs.mkdirSync(dir, { recursive: true })
  const configPath = path.join(dir, 'mcp-config.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
  return configPath
}

function writeOpencodeConfig(command: string[]): string {
  // Write to a project-local .opencode/opencode.json so opencode picks it up.
  // We write to a temp project config dir and set it as the cwd for the agent,
  // or we can write to the user config. Project-local is cleaner — it doesn't
  // pollute the user's global config and it's automatically discovered.
  const dir = path.join(os.tmpdir(), 'fonagents')
  fs.mkdirSync(dir, { recursive: true })

  // opencode loads config from .opencode/opencode.json in the cwd.
  // We write a standalone config that the daemon will symlink or copy into
  // the project's .opencode/ directory. For now, write to the temp dir and
  // the daemon will handle placement.
  const opencodeDir = path.join(dir, '.opencode')
  fs.mkdirSync(opencodeDir, { recursive: true })
  const configPath = path.join(opencodeDir, 'opencode.json')

  const config = {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      fonagents: {
        type: 'local',
        command,
      },
    },
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
  return configPath
}
