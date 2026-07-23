import { EventEmitter } from 'events';
export interface OverseerConfig {
    enabled: boolean;
    mode: 'queue' | 'batch';
    debounceMs: number;
    maxConcurrent: number;
    timeoutSec: number;
}
export interface OverseerHandle {
    id: string;
    sessionName: string;
    status: 'running' | 'completed' | 'failed' | 'timed_out';
    startedAt: number;
    finishedAt?: number;
}
export declare class Overseer {
    private eventBus;
    private config;
    private projectDir;
    private queue;
    private active;
    private debounceTimer;
    private isProcessing;
    private listener;
    constructor(eventBus: EventEmitter, config: OverseerConfig, projectDir: string);
    start(): void;
    stop(): void;
    setEnabled(enabled: boolean): void;
    getConfig(): OverseerConfig;
    getStatus(): {
        config: OverseerConfig;
        activeOverseers: number;
        queueLength: number;
    };
    private persistConfig;
    private handleWorkerEvent;
    private enqueue;
    private processQueue;
    private batch;
    private processBatch;
    private runOverseer;
    private pollOverseer;
    private onOverseerDone;
}
//# sourceMappingURL=overseer.d.ts.map