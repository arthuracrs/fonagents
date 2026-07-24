"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActorService = void 0;
class ActorService {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    list() {
        return this.storage.listActors();
    }
    get(id) {
        return this.storage.getActor(id);
    }
    create(input) {
        return this.storage.createActor(input);
    }
}
exports.ActorService = ActorService;
//# sourceMappingURL=ActorService.js.map