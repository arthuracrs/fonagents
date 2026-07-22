"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOverseerPrompt = exports.OVERSEER_SYSTEM_PROMPT = exports.INITIAL_PROMPT = exports.buildWorkerSystemPrompt = exports.DEFAULT_PROMPT = exports.MANAGER_PROMPT = void 0;
var manager_system_js_1 = require("./manager-system.js");
Object.defineProperty(exports, "MANAGER_PROMPT", { enumerable: true, get: function () { return manager_system_js_1.MANAGER_PROMPT; } });
var worker_user_default_js_1 = require("./worker-user-default.js");
Object.defineProperty(exports, "DEFAULT_PROMPT", { enumerable: true, get: function () { return worker_user_default_js_1.DEFAULT_PROMPT; } });
var worker_system_js_1 = require("./worker-system.js");
Object.defineProperty(exports, "buildWorkerSystemPrompt", { enumerable: true, get: function () { return worker_system_js_1.buildWorkerSystemPrompt; } });
var manager_initial_js_1 = require("./manager-initial.js");
Object.defineProperty(exports, "INITIAL_PROMPT", { enumerable: true, get: function () { return manager_initial_js_1.INITIAL_PROMPT; } });
var overseer_system_js_1 = require("./overseer-system.js");
Object.defineProperty(exports, "OVERSEER_SYSTEM_PROMPT", { enumerable: true, get: function () { return overseer_system_js_1.OVERSEER_SYSTEM_PROMPT; } });
var overseer_user_js_1 = require("./overseer-user.js");
Object.defineProperty(exports, "buildOverseerPrompt", { enumerable: true, get: function () { return overseer_user_js_1.buildOverseerPrompt; } });
//# sourceMappingURL=index.js.map