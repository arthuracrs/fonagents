export type ActorType = 'human' | 'agent' | 'system';

export interface Actor {
  id: string;
  name: string;
  type: ActorType;
  email?: string;
  metadata?: Record<string, unknown>;
}
