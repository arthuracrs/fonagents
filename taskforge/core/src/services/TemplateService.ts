import type { Task } from '../domain/Task.js';
import type { Template } from '../domain/Template.js';
import type { StoragePort } from '../ports/StoragePort.js';
import type { TaskService } from './TaskService.js';

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export class TemplateService {
  constructor(
    private readonly storage: StoragePort,
    private readonly taskService: TaskService,
  ) {}

  async list(): Promise<Template[]> {
    return this.storage.listTemplates();
  }

  async get(name: string): Promise<Template> {
    const template = await this.storage.getTemplate(name);
    if (!template) throw new Error(`Template "${name}" not found`);
    return template;
  }

  async create(input: Template): Promise<Template> {
    return this.storage.createTemplate(input);
  }

  async delete(name: string): Promise<void> {
    await this.get(name);
    return this.storage.deleteTemplate(name);
  }

  async pour(name: string, vars: Record<string, string>): Promise<Task[]> {
    const template = await this.get(name);

    this.validateVars(template, vars);

    const created: Task[] = [];

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
          throw new Error(
            `Invalid dependency reference "${depRef}" in template task ${i}`,
          );
        }
        await this.taskService.addDependency(created[i].id, created[depIndex].id);
      }
    }

    return created;
  }

  private validateVars(template: Template, vars: Record<string, string>): void {
    const missing = template.variables.filter((v) => !(v in vars));
    if (missing.length > 0) {
      throw new Error(
        `Missing required variables: ${missing.join(', ')}`,
      );
    }
  }

  private substitute(text: string, vars: Record<string, string>): string {
    return text.replace(PLACEHOLDER_RE, (_, key: string) => {
      if (!(key in vars)) {
        throw new Error(`Undefined variable "${key}"`);
      }
      return vars[key];
    });
  }
}
