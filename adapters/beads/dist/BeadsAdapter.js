"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BeadsAdapter = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const mapper_js_1 = require("./mapper.js");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
// Implements IssueTrackerPort by shelling out to the `bd` CLI.
// Every command uses --json for structured output. execFile (not exec) is used
// throughout to avoid shell injection — arguments are passed as an array.
class BeadsAdapter {
    bin;
    projectDir;
    actor;
    constructor(config) {
        this.bin = config.bdPath ?? this.detectBd();
        this.projectDir = config.projectDir;
        this.actor = config.actor;
    }
    // ── Issues ──────────────────────────────────────────────────────────────────
    async listIssues(filter) {
        const args = ['list', '--all', '-n', '0', '--json'];
        const raw = await this.run(args);
        const items = this.parseArray(raw);
        let issues = items.map(mapper_js_1.mapIssue);
        if (filter)
            issues = this.applyFilter(issues, filter);
        return issues;
    }
    async getIssue(id) {
        try {
            const raw = await this.run(['show', id, '--json']);
            const items = this.parseArray(raw);
            return items.length > 0 ? (0, mapper_js_1.mapIssue)(items[0]) : undefined;
        }
        catch {
            return undefined;
        }
    }
    async createIssue(input) {
        const args = ['create', input.title, '--json'];
        if (input.description)
            args.push('-d', input.description);
        if (input.type)
            args.push('-t', input.type);
        if (input.priority !== undefined)
            args.push('-p', String(input.priority));
        if (input.assignee)
            args.push('--assignee', input.assignee);
        if (input.labels)
            for (const l of input.labels)
                args.push('--label', l);
        if (input.parent)
            args.push('--parent', input.parent);
        if (input.skills)
            for (const s of input.skills)
                args.push('--skills', s);
        if (input.deps)
            args.push('--deps', input.deps.join(','));
        if (input.waitsFor) {
            args.push('--waits-for', input.waitsFor);
            if (input.waitsForGate)
                args.push('--waits-for-gate', input.waitsForGate);
        }
        const raw = await this.run(args);
        const parsed = JSON.parse(raw);
        return (0, mapper_js_1.mapIssue)(Array.isArray(parsed) ? parsed[0] : parsed);
    }
    async updateIssue(id, patch) {
        const args = ['update', id, '--json'];
        if (patch.status)
            args.push('--status', patch.status);
        if (patch.priority !== undefined)
            args.push('--priority', String(patch.priority));
        if (patch.assignee !== undefined)
            args.push('--assignee', patch.assignee);
        if (patch.title)
            args.push('--title', patch.title);
        const raw = await this.run(args);
        const parsed = JSON.parse(raw);
        return (0, mapper_js_1.mapIssue)(Array.isArray(parsed) ? parsed[0] : parsed);
    }
    async closeIssue(id, reason) {
        const args = ['close', id, '--json'];
        if (reason)
            args.push('--reason', reason);
        const raw = await this.run(args);
        const parsed = JSON.parse(raw);
        return (0, mapper_js_1.mapIssue)(Array.isArray(parsed) ? parsed[0] : parsed);
    }
    async reopenIssue(id) {
        const raw = await this.run(['reopen', id, '--json']);
        const parsed = JSON.parse(raw);
        return (0, mapper_js_1.mapIssue)(Array.isArray(parsed) ? parsed[0] : parsed);
    }
    async claimIssue(id) {
        const raw = await this.run(['update', id, '--claim', '--json']);
        const parsed = JSON.parse(raw);
        return (0, mapper_js_1.mapIssue)(Array.isArray(parsed) ? parsed[0] : parsed);
    }
    // ── Comments ────────────────────────────────────────────────────────────────
    async addComment(id, body) {
        const raw = await this.run(['comment', id, body, '--json']);
        return (0, mapper_js_1.mapComment)(JSON.parse(raw), id);
    }
    async listComments(id) {
        const raw = await this.run(['comments', id, '--json']);
        const items = this.parseArray(raw);
        return items.map((c) => (0, mapper_js_1.mapComment)(c, id));
    }
    // ── Dependencies & hierarchy ─────────────────────────────────────────────────
    async listDependencies(id) {
        const raw = await this.run(['dep', 'list', id, '--json']);
        const items = this.parseArray(raw);
        return items.map(mapper_js_1.mapDependency);
    }
    async addDependency(childId, parentId, type) {
        const args = ['dep', 'add', childId, parentId, '--json'];
        if (type)
            args.push('--type', type);
        await this.run(args);
    }
    async children(parentId) {
        const raw = await this.run(['children', parentId, '--json']);
        const items = this.parseArray(raw);
        return items.map(mapper_js_1.mapIssue);
    }
    // ── Ready work ───────────────────────────────────────────────────────────────
    async readyWork(opts) {
        const args = ['ready', '--json'];
        if (opts?.molId)
            args.push('--mol', opts.molId);
        if (opts?.gated)
            args.push('--gated');
        if (opts?.assignee)
            args.push('--assignee', opts.assignee);
        if (opts?.claim)
            args.push('--claim');
        const raw = await this.run(args);
        const items = this.parseArray(raw);
        return items.map(mapper_js_1.mapReadyWork);
    }
    // ── Molecules & formulas ─────────────────────────────────────────────────────
    async listFormulas() {
        const raw = await this.run(['formula', 'list', '--json']);
        if (!raw || raw.trim() === 'null')
            return [];
        const items = this.parseArray(raw);
        return items.map(mapper_js_1.mapFormula);
    }
    async showFormula(name) {
        const raw = await this.run(['formula', 'show', name, '--json']);
        return raw ? JSON.parse(raw) : null;
    }
    async pourMolecule(formulaName, vars, opts) {
        const args = ['mol', 'pour', formulaName, '--json'];
        for (const [k, v] of Object.entries(vars))
            args.push('--var', `${k}=${v}`);
        if (opts?.assignee)
            args.push('--assignee', opts.assignee);
        const raw = await this.run(args);
        const parsed = JSON.parse(raw);
        const molRaw = Array.isArray(parsed) ? parsed[0] : parsed;
        return (0, mapper_js_1.mapMolecule)(molRaw);
    }
    async listMolecules() {
        // Molecules are issues with mol-type metadata. We query via bd list with a
        // label filter or use bd mol list if available. For now, use bd list and
        // filter for issues that have molecule metadata.
        const raw = await this.run(['list', '--all', '-n', '0', '--json']);
        const items = this.parseArray(raw);
        return items
            .filter((i) => i.mol_type !== undefined)
            .map(mapper_js_1.mapMolecule);
    }
    async showMolecule(id) {
        const raw = await this.run(['mol', 'show', id, '--json']);
        return raw ? JSON.parse(raw) : null;
    }
    // ── Gates ────────────────────────────────────────────────────────────────────
    async listGates(opts) {
        const args = ['gate', 'list', '--json'];
        if (opts?.open === false)
            args.push('--all');
        const raw = await this.run(args);
        if (!raw || raw.trim() === 'null')
            return [];
        const items = this.parseArray(raw);
        return items.map(mapper_js_1.mapGate);
    }
    async createGate(input) {
        const args = ['gate', 'create', input.issueId, '--type', input.type, '--json'];
        if (input.reason)
            args.push('--reason', input.reason);
        if (input.awaitId)
            args.push('--await-id', input.awaitId);
        const raw = await this.run(args);
        const parsed = JSON.parse(raw);
        return (0, mapper_js_1.mapGate)(Array.isArray(parsed) ? parsed[0] : parsed);
    }
    async resolveGate(gateId) {
        const raw = await this.run(['gate', 'resolve', gateId, '--json']);
        const parsed = JSON.parse(raw);
        return (0, mapper_js_1.mapGate)(Array.isArray(parsed) ? parsed[0] : parsed);
    }
    // ── Audit ────────────────────────────────────────────────────────────────────
    async recordAudit(input) {
        const args = ['audit', 'record', '--actor', input.actor, '--event', input.event];
        if (input.payload)
            args.push('--payload', JSON.stringify(input.payload));
        await this.run(args);
    }
    // ── Internals ────────────────────────────────────────────────────────────────
    async run(args) {
        const finalArgs = this.actor ? ['--actor', this.actor, ...args] : args;
        const { stdout } = await execFileAsync(this.bin, finalArgs, {
            cwd: this.projectDir,
            maxBuffer: 10 * 1024 * 1024,
        });
        return stdout.trim();
    }
    parseArray(raw) {
        if (!raw || raw.trim() === 'null' || raw.trim() === '')
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
    }
    applyFilter(issues, filter) {
        return issues.filter((i) => {
            if (filter.status && i.status !== filter.status)
                return false;
            if (filter.type && i.type !== filter.type)
                return false;
            if (filter.priority !== undefined && String(i.priority) !== String(filter.priority))
                return false;
            if (filter.assignee && i.assignee !== filter.assignee)
                return false;
            if (filter.labels) {
                for (const l of filter.labels) {
                    if (!i.labels.includes(l))
                        return false;
                }
            }
            if (filter.parent && i.parentId !== filter.parent)
                return false;
            return true;
        });
    }
    detectBd() {
        // Check common locations, fallback to PATH lookup
        const candidates = [
            '/opt/homebrew/bin/bd',
            path_1.default.join(process.env.HOME ?? '', '.local/bin/bd'),
        ];
        for (const c of candidates) {
            if (fs_1.default.existsSync(c))
                return c;
        }
        return 'bd';
    }
}
exports.BeadsAdapter = BeadsAdapter;
//# sourceMappingURL=BeadsAdapter.js.map