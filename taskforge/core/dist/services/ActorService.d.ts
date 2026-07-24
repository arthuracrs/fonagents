import type { Actor, ActorType } from '../domain/Actor';
import type { StoragePort } from '../ports/StoragePort';
export declare class ActorService {
    private readonly storage;
    constructor(storage: StoragePort);
    list(): Promise<Actor[]>;
    get(id: string): Promise<Actor | undefined>;
    create(input: {
        name: string;
        type: ActorType;
        email?: string;
    }): Promise<Actor>;
}
//# sourceMappingURL=ActorService.d.ts.map