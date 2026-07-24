import { execFile } from 'child_process';
import { promisify } from 'util';
import type { TaskService, ActorService } from '@taskforge/core';

const execFileAsync = promisify(execFile);

interface BdIssue {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  issue_type: string;
  owner?: string;
  assignee?: string;
  labels?: string[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
  close_reason?: string;
  dependencies?: { id: string }[];
  parent_id?: string;
}

export interface MigrationResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function migrateFromBeads(opts: {
  projectDir?: string;
  tasks: TaskService;
  actors: ActorService;
}): Promise<MigrationResult> {
  const result: MigrationResult = { imported: 0, skipped: 0, errors: [] };

  const { stdout } = await execFileAsync('bd', ['list', '--all', '-n', '0', '--json'], {
    cwd: opts.projectDir ?? process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });

  const raw = stdout.trim();
  if (!raw || raw === 'null') return result;
  const issues: BdIssue[] = JSON.parse(raw);
  if (!Array.isArray(issues) || issues.length === 0) return result;

  const assignees = new Set<string>();
  for (const issue of issues) {
    const a = issue.assignee || issue.owner;
    if (a) assignees.add(a);
  }
  for (const name of assignees) {
    try {
      const actors = await opts.actors.list();
      const exists = actors.find((a: any) => a.name === name);
      if (!exists) {
        await opts.actors.create({ name, type: 'human' as const });
      }
    } catch {}
  }

  for (const issue of issues) {
    try {
      const rawType = issue.issue_type || 'task';
      const type = rawType === 'bug' || rawType === 'feature' || rawType === 'epic' ? rawType : 'task';
      await opts.tasks.create({
        title: issue.title,
        description: issue.description ?? '',
        priority: Math.min(4, Math.max(0, Math.round(issue.priority ?? 2))) as 0 | 1 | 2 | 3 | 4,
        type,
        assignee: issue.assignee || issue.owner,
        labels: issue.labels ?? [],
        parentId: issue.parent_id,
      });
      result.imported++;
    } catch (err) {
      result.errors.push(`Failed to import ${issue.id}: ${(err as Error).message}`);
      result.skipped++;
    }
  }

  for (const issue of issues) {
    if (issue.dependencies?.length) {
      for (const dep of issue.dependencies) {
        try {
          await opts.tasks.addDependency(issue.id, dep.id);
        } catch {}
      }
    }
  }

  return result;
}
