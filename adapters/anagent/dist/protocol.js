"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateEvent = translateEvent;
exports.parseNdjsonLine = parseNdjsonLine;
// ── Translation: anagent event → core AgentStreamEvent ────────────────────────
function translateEvent(ev) {
    switch (ev.type) {
        case 'start':
            return { type: 'session', sessionId: ev.sessionId };
        case 'text':
            return { type: 'text', delta: ev.delta };
        case 'tool_use':
            return { type: 'tool_use', tool: ev.name, input: ev.input };
        case 'tool_result':
            return { type: 'tool_result', toolUseId: ev.id, content: ev.text, isError: ev.isError };
        case 'done':
            return { type: 'done', exitCode: ev.exitCode, durationMs: ev.durationMs ?? 0 };
        case 'failed':
            return { type: 'failed', error: ev.error, exitCode: ev.exitCode, durationMs: ev.durationMs ?? 0 };
        default:
            return null;
    }
}
// ── NDJSON line parser ────────────────────────────────────────────────────────
function parseNdjsonLine(line) {
    const trimmed = line.trim();
    if (!trimmed)
        return null;
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=protocol.js.map