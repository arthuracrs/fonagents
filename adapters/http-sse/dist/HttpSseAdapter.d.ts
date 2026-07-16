import { type Express } from 'express';
import type { ManagerToolsPort, UiCommandPort } from '@fonagents/core';
import { SseEventBus } from './SseEventBus.js';
export interface HttpSseAdapterConfig {
    port: number;
    projectDir: string;
    mcpServerScriptPath?: string;
}
export declare function createHttpSseApp(command: UiCommandPort, managerTools: ManagerToolsPort, eventBus: SseEventBus, config: HttpSseAdapterConfig): {
    app: Express;
};
//# sourceMappingURL=HttpSseAdapter.d.ts.map