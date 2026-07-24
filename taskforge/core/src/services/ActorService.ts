import type { Actor, ActorType } from '../domain/Actor';
import type { StoragePort } from '../ports/StoragePort';

export class ActorService {
  constructor(private readonly storage: StoragePort) {}

  list(): Promise<Actor[]> {
    return this.storage.listActors();
  }

  get(id: string): Promise<Actor | undefined> {
    return this.storage.getActor(id);
  }

  create(input: { name: string; type: ActorType; email?: string }): Promise<Actor> {
    return this.storage.createActor(input);
  }
}
