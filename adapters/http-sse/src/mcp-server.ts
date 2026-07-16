#!/usr/bin/env node
// MCP server script — spawned by claude code as a subprocess.
// Bridges JSON-RPC 2.0 (stdio) to the daemon's HTTP API.
//
// Lifecycle:
//   1. claude code spawns this script (per --mcp-config)
//   2. claude code sends `initialize` → we respond with capabilities
//   3. claude code sends `tools/list` → we return MANAGER_TOOL_SCHEMAS
//   4. claude code sends `tools/call` → we POST to the daemon and return the result
//   5. Process exits when stdin closes (claude code session ends)

import { MANAGER_TOOL_SCHEMAS } from '@fonagents/core'

// Parse --daemon-url from argv
const daemonUrl = (() => {
  const idx = process.argv.indexOf('--daemon-url')
  return idx >= 0 ? process.argv[idx + 1] : 'http://localhost:3001'
})()

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string }
}

function send(msg: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

async function handleRequest(req: JsonRpcRequest): Promise<unknown> {
  switch (req.method) {
    case 'initialize':
      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'fonagents', version: '0.0.0' },
      }

    case 'tools/list':
      return {
        tools: MANAGER_TOOL_SCHEMAS.map((s) => ({
          name: s.name,
          description: s.description,
          inputSchema: s.inputSchema,
        })),
      }

    case 'tools/call': {
      const params = req.params ?? {}
      const toolName = params.name as string
      const args = (params.arguments ?? {}) as Record<string, unknown>
      const url = `${daemonUrl}/api/mcp/tools/${encodeURIComponent(toolName)}`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(args),
      })
      const result = await resp.json()
      if (!resp.ok) {
        throw new Error((result as { error?: string }).error ?? `HTTP ${resp.status}`)
      }
      // MCP tool results are returned as content blocks
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      }
    }

    case 'ping':
      return {}

    default:
      throw new Error(`Unknown method: ${req.method}`)
  }
}

// Track pending requests so we don't exit while async operations are in flight.
let pendingCount = 0

// Read newline-delimited JSON-RPC from stdin
let buf = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', async (chunk: string) => {
  buf += chunk
  const lines = buf.split('\n')
  buf = lines.pop() ?? ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let req: JsonRpcRequest
    try {
      req = JSON.parse(trimmed) as JsonRpcRequest
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
      continue
    }
    pendingCount++
    try {
      const result = await handleRequest(req)
      send({ jsonrpc: '2.0', id: req.id, result })
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32603, message: (err as Error).message },
      })
    } finally {
      pendingCount--
      maybeExit()
    }
  }
})

function maybeExit(): void {
  // Only exit when stdin has closed AND no async operations are pending.
  if (stdinClosed && pendingCount === 0) {
    process.exit(0)
  }
}

let stdinClosed = false
process.stdin.on('end', () => {
  stdinClosed = true
  maybeExit()
})
