export type EventType =
  | 'created'
  | 'updated'
  | 'closed'
  | 'reopened'
  | 'claimed'
  | 'commented'
  | 'gate_opened'
  | 'gate_resolved';

export interface Event {
  id: string;
  taskId: string;
  actorId: string;
  type: EventType;
  payload: Record<string, unknown>;
  timestamp: string;
}
