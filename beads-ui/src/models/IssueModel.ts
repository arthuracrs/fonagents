import type { Issue, Status, IssueType, Dependency, Comment } from "../types";
import { TimeFormatter } from "../lib/TimeFormatter";

export class IssueModel implements Issue {
  id!: string;
  title!: string;
  description?: string;
  status!: Status;
  priority!: number;
  type!: IssueType;
  assignee?: string;
  labels?: string[];
  createdAt!: string;
  updatedAt!: string;
  parentId?: string;
  closed_at?: string;
  close_reason?: string;
  due_at?: string;
  defer_until?: string;
  dependencies?: Dependency[];
  comments?: Comment[];

  private constructor(data: Issue) {
    Object.assign(this, data);
  }

  static from(data: Issue): IssueModel {
    return new IssueModel(data);
  }

  isOpen(): boolean { return this.status === "open"; }
  isClosed(): boolean { return this.status === "closed"; }
  isBlocked(): boolean { return this.status === "blocked"; }
  isInProgress(): boolean { return this.status === "in_progress"; }
  isDeferred(): boolean { return this.status === "deferred"; }
  isCritical(): boolean { return this.priority === 0; }

  timeAgo(): string { return TimeFormatter.timeAgo(this.updatedAt); }
  createdFmt(): string { return TimeFormatter.fmt(this.createdAt); }
  updatedFmt(): string { return TimeFormatter.fmt(this.updatedAt); }
  closedFmt(): string { return TimeFormatter.fmt(this.closed_at); }

  commentCount(): number { return this.comments?.length ?? 0; }
}
