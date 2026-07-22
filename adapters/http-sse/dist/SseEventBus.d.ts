import { EventEmitter } from 'events';
import type { Response } from 'express';
import type { UiEvent, UiEventPort } from '@fonagents/core';
export declare class SseEventBus implements UiEventPort {
    readonly events: EventEmitter<[never]>;
    private readonly clients;
    addClient(res: Response): void;
    removeClient(res: Response): void;
    emit(event: UiEvent): void;
    get clientCount(): number;
}
//# sourceMappingURL=SseEventBus.d.ts.map