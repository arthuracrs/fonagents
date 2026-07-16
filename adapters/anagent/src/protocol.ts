import type { AgentStreamEvent } from '@fonagents/core'

// anagent NDJSON event shapes (as emitted by anagent's streaming emitter).
// These match anagent/src/streaming/events.ts but are redefined here so the
// adapter doesn't depend on anagent's internals — only on its stdout protocol.

interface AnagentStartEvent {
  type: 'start'
  runtime: string
  mode: string
  sessionId: string
  tmuxSession?: string
}

interface AnagentTextEvent {
  type: 'text'
  delta: string
}

interface AnagentToolUseEvent {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

interface AnagentToolResultEvent {
  type: 'tool_result'
  id: string
  name: string
  text: string
  isError: boolean
}

interface AnagentDoneEvent {
  type: 'done'
  exitCode: number
  durationMs?: number
  output?: string
  costUsd?: number
}

interface AnagentFailedEvent {
  type: 'failed'
  error: string
  exitCode: number
  durationMs?: number
  output?: string
}

type AnagentEvent =
  | AnagentStartEvent
  | AnagentTextEvent
  | AnagentToolUseEvent
  | AnagentToolResultEvent
  | AnagentDoneEvent
  | AnagentFailedEvent

// ── Translation: anagent event → core AgentStreamEvent ────────────────────────

export function translateEvent(ev: AnagentEvent): AgentStreamEvent | null {
  switch (ev.type) {
    case 'start':
      return { type: 'session', sessionId: ev.sessionId }
    case 'text':
      return { type: 'text', delta: ev.delta }
    case 'tool_use':
      return { type: 'tool_use', tool: ev.name, input: ev.input }
    case 'tool_result':
      return { type: 'tool_result', toolUseId: ev.id, content: ev.text, isError: ev.isError }
    case 'done':
      return { type: 'done', exitCode: ev.exitCode, durationMs: ev.durationMs ?? 0 }
    case 'failed':
      return { type: 'failed', error: ev.error, exitCode: ev.exitCode, durationMs: ev.durationMs ?? 0 }
    default:
      return null
  }
}

// ── NDJSON line parser ────────────────────────────────────────────────────────

export function parseNdjsonLine(line: string): AnagentEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as AnagentEvent
  } catch {
    return null
  }
}
