#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const daemon_js_1 = require("./daemon.js");
const child_process_1 = require("child_process");
const net_1 = __importDefault(require("net"));
function findFreePort(start) {
    return new Promise((resolve, reject) => {
        const server = net_1.default.createServer();
        server.listen(start, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
        server.on('error', () => findFreePort(start + 1).then(resolve, reject));
    });
}
function openBrowser(url) {
    const cmd = process.platform === 'darwin'
        ? `open "${url}"`
        : process.platform === 'win32'
            ? `start "" "${url}"`
            : `xdg-open "${url}"`;
    (0, child_process_1.exec)(cmd);
}
async function main() {
    const port = await findFreePort(parseInt(process.env.PORT ?? '3001', 10));
    (0, daemon_js_1.startDaemon)({ port });
    setTimeout(() => {
        const url = `http://localhost:${port}`;
        console.log(`Opening ${url}`);
        openBrowser(url);
    }, 800);
}
main();
//# sourceMappingURL=cli.js.map