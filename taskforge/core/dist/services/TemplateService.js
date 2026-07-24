"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateService = void 0;
const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;
class TemplateService {
    storage;
    taskService;
    constructor(storage, taskService) {
        this.storage = storage;
        this.taskService = taskService;
    }
    async list() {
        return this.storage.listTemplates();
    }
    async get(name) {
        const template = await this.storage.getTemplate(name);
        if (!template)
            throw new Error(`Template "${name}" not found`);
        return template;
    }
    async create(input) {
        return this.storage.createTemplate(input);
    }
    async delete(name) {
        await this.get(name);
        return this.storage.deleteTemplate(name);
    }
    async pour(name, vars) {
        const template = await this.get(name);
        this.validateVars(template, vars);
        const created = [];
        for (const taskTpl of template.tasks) {
            const task = await this.taskService.create({
                title: this.substitute(taskTpl.title, vars),
                description: taskTpl.description
                    ? this.substitute(taskTpl.description, vars)
                    : undefined,
                priority: taskTpl.priority,
                type: taskTpl.type,
                labels: taskTpl.labels,
            });
            created.push(task);
        }
        for (let i = 0; i < template.tasks.length; i++) {
            const taskTpl = template.tasks[i];
            for (const depRef of taskTpl.dependencies) {
                const depIndex = Number(depRef);
                if (Number.isNaN(depIndex) || depIndex < 0 || depIndex >= created.length) {
                    throw new Error(`Invalid dependency reference "${depRef}" in template task ${i}`);
                }
                await this.taskService.addDependency(created[i].id, created[depIndex].id);
            }
        }
        return created;
    }
    validateVars(template, vars) {
        const missing = template.variables.filter((v) => !(v in vars));
        if (missing.length > 0) {
            throw new Error(`Missing required variables: ${missing.join(', ')}`);
        }
    }
    substitute(text, vars) {
        return text.replace(PLACEHOLDER_RE, (_, key) => {
            if (!(key in vars)) {
                throw new Error(`Undefined variable "${key}"`);
            }
            return vars[key];
        });
    }
}
exports.TemplateService = TemplateService;
//# sourceMappingURL=TemplateService.js.map