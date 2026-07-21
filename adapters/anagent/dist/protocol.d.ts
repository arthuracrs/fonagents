import type { AgentStreamEvent } from '@fonagents/core';
interface AnagentStartEvent {
    type: 'start';
    runtime: string;
    mode: string;
    sessionId: string;
    tmuxSession?: string;
}
interface AnagentTextEvent {
    type: 'text';
    delta: string;
}
interface AnagentToolUseEvent {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, unknown>;
}
interface AnagentToolResultEvent {
    type: 'tool_result';
    id: string;
    name: string;
    text: string;
    isError: boolean;
}
interface AnagentDoneEvent {
    type: 'done';
    exitCode: number;
    durationMs?: number;
    output?: string;
    costUsd?: number;
}
interface AnagentFailedEvent {
    type: 'failed';
    error: string;
    exitCode: number;
    durationMs?: number;
    output?: string;
}
export type AnagentEvent = AnagentStartEvent | AnagentTextEvent | AnagentToolUseEvent | AnagentToolResultEvent | AnagentDoneEvent | AnagentFailedEvent;
export declare function translateEvent(ev: AnagentEvent): AgentStreamEvent | null;
export declare function parseNdjsonLine(line: string): AnagentEvent | null;
export {};
//# sourceMappingURL=protocol.d.ts.map