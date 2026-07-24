import type { TaskService, ActorService } from '@taskforge/core';
export interface MigrationResult {
    imported: number;
    skipped: number;
    errors: string[];
}
export declare function migrateFromBeads(opts: {
    projectDir?: string;
    tasks: TaskService;
    actors: ActorService;
}): Promise<MigrationResult>;
