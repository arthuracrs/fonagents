import type { Task } from '../domain/Task.js';
import type { Template } from '../domain/Template.js';
import type { StoragePort } from '../ports/StoragePort.js';
import type { TaskService } from './TaskService.js';
export declare class TemplateService {
    private readonly storage;
    private readonly taskService;
    constructor(storage: StoragePort, taskService: TaskService);
    list(): Promise<Template[]>;
    get(name: string): Promise<Template>;
    create(input: Template): Promise<Template>;
    delete(name: string): Promise<void>;
    pour(name: string, vars: Record<string, string>): Promise<Task[]>;
    private validateVars;
    private substitute;
}
//# sourceMappingURL=TemplateService.d.ts.map