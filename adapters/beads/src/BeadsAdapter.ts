import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import type {
  Comment,
  Dependency,
  FormulaSummary,
  Gate,
  GateId,
  GateType,
  Issue,
  IssueId,
  IssueTrackerPort,
  IssueCreateInput,
  IssueFilter,
  IssueUpdatePatch,
  Molecule,
  MoleculeId,
  ReadyWork,
} from '@fonagents/core'
import {
  mapComment,
  mapDependency,
  mapFormula,
  mapGate,
  mapIssue,
  mapMolecule,
  mapReadyWork,
  type BdComment,
  type BdDependency,
  type BdFormula,
  type BdGate,
  type BdIssue,
} from './mapper.js'

const execFileAsync = promisify(execFile)

export interface BeadsAdapterConfig {
  bdPath?: string
  projectDir: string
  actor?: string
}

// Implements IssueTrackerPort by shelling out to the `bd` CLI.
// Every command uses --json for structured output. execFile (not exec) is used
// throughout to avoid shell injection — arguments are passed as an array.
export class BeadsAdapter implements IssueTrackerPort {
  private readonly bin: string
  private readonly projectDir: string
  private readonly actor?: string

  constructor(config: BeadsAdapterConfig) {
    this.bin = config.bdPath ?? this.detectBd()
    this.projectDir = config.projectDir
    this.actor = config.actor
  }

  // ── Issues ──────────────────────────────────────────────────────────────────

  async listIssues(filter?: IssueFilter): Promise<Issue[]> {
    const args = ['list', '--all', '-n', '0', '--json']
    const raw = await this.run(args)
    const items = this.parseArray<BdIssue>(raw)
    let issues = items.map(mapIssue)
    if (filter) issues = this.applyFilter(issues, filter)
    return issues
  }

  async getIssue(id: IssueId): Promise<Issue | undefined> {
    try {
      const raw = await this.run(['show', id, '--json'])
      const items = this.parseArray<BdIssue>(raw)
      return items.length > 0 ? mapIssue(items[0]) : undefined
    } catch {
      return undefined
    }
  }

  async createIssue(input: IssueCreateInput): Promise<Issue> {
    const args = ['create', input.title, '--json']
    if (input.description) args.push('-d', input.description)
    if (input.type) args.push('-t', input.type)
    if (input.priority !== undefined) args.push('-p', String(input.priority))
    if (input.assignee) args.push('--assignee', input.assignee)
    if (input.labels) for (const l of input.labels) args.push('--label', l)
    if (input.parent) args.push('--parent', input.parent)
    if (input.skills) for (const s of input.skills) args.push('--skills', s)
    if (input.deps) args.push('--deps', input.deps.join(','))
    if (input.waitsFor) {
      args.push('--waits-for', input.waitsFor)
      if (input.waitsForGate) args.push('--waits-for-gate', input.waitsForGate)
    }
    const raw = await this.run(args)
    const parsed = JSON.parse(raw)
    return mapIssue(Array.isArray(parsed) ? parsed[0] : parsed)
  }

  async updateIssue(id: IssueId, patch: IssueUpdatePatch): Promise<Issue> {
    const args = ['update', id, '--json']
    if (patch.status) args.push('--status', patch.status)
    if (patch.priority !== undefined) args.push('--priority', String(patch.priority))
    if (patch.assignee !== undefined) args.push('--assignee', patch.assignee)
    if (patch.title) args.push('--title', patch.title)
    const raw = await this.run(args)
    const parsed = JSON.parse(raw)
    return mapIssue(Array.isArray(parsed) ? parsed[0] : parsed)
  }

  async closeIssue(id: IssueId, reason?: string): Promise<Issue> {
    const args = ['close', id, '--json']
    if (reason) args.push('--reason', reason)
    const raw = await this.run(args)
    const parsed = JSON.parse(raw)
    return mapIssue(Array.isArray(parsed) ? parsed[0] : parsed)
  }

  async reopenIssue(id: IssueId): Promise<Issue> {
    const raw = await this.run(['reopen', id, '--json'])
    const parsed = JSON.parse(raw)
    return mapIssue(Array.isArray(parsed) ? parsed[0] : parsed)
  }

  async claimIssue(id: IssueId): Promise<Issue> {
    const raw = await this.run(['update', id, '--claim', '--json'])
    const parsed = JSON.parse(raw)
    return mapIssue(Array.isArray(parsed) ? parsed[0] : parsed)
  }

  // ── Comments ────────────────────────────────────────────────────────────────

  async addComment(id: IssueId, body: string, actor?: string): Promise<Comment> {
    const raw = await this.run(['comment', id, body, '--json'], actor)
    return mapComment(JSON.parse(raw), id)
  }

  async listComments(id: IssueId): Promise<Comment[]> {
    const raw = await this.run(['comments', id, '--json'])
    const items = this.parseArray<BdComment>(raw)
    return items.map((c) => mapComment(c, id))
  }

  // ── Dependencies & hierarchy ─────────────────────────────────────────────────

  async listDependencies(id: IssueId): Promise<Dependency[]> {
    const raw = await this.run(['dep', 'list', id, '--json'])
    const items = this.parseArray<BdDependency>(raw)
    return items.map(mapDependency)
  }

  async addDependency(childId: IssueId, parentId: IssueId, type?: string): Promise<void> {
    const args = ['dep', 'add', childId, parentId, '--json']
    if (type) args.push('--type', type)
    await this.run(args)
  }

  async children(parentId: IssueId): Promise<Issue[]> {
    const raw = await this.run(['children', parentId, '--json'])
    const items = this.parseArray<BdIssue>(raw)
    return items.map(mapIssue)
  }

  // ── Ready work ───────────────────────────────────────────────────────────────

  async readyWork(opts?: { molId?: MoleculeId; gated?: boolean; assignee?: string; claim?: boolean }): Promise<ReadyWork[]> {
    const args = ['ready', '--json']
    if (opts?.molId) args.push('--mol', opts.molId)
    if (opts?.gated) args.push('--gated')
    if (opts?.assignee) args.push('--assignee', opts.assignee)
    if (opts?.claim) args.push('--claim')
    const raw = await this.run(args)
    const items = this.parseArray<BdIssue>(raw)
    return items.map(mapReadyWork)
  }

  // ── Molecules & formulas ─────────────────────────────────────────────────────

  async listFormulas(): Promise<FormulaSummary[]> {
    const raw = await this.run(['formula', 'list', '--json'])
    if (!raw || raw.trim() === 'null') return []
    const items = this.parseArray<BdFormula>(raw)
    return items.map(mapFormula)
  }
  async showFormula(name: string): Promise<unknown> {
    const raw = await this.run(['formula', 'show', name, '--json'])
    return raw ? JSON.parse(raw) : null
  }

  async pourMolecule(
    formulaName: string,
    vars: Record<string, string>,
    opts?: { assignee?: string },
  ): Promise<Molecule> {
    const args = ['mol', 'pour', formulaName, '--json']
    for (const [k, v] of Object.entries(vars)) args.push('--var', `${k}=${v}`)
    if (opts?.assignee) args.push('--assignee', opts.assignee)
    const raw = await this.run(args)
    const parsed = JSON.parse(raw)
    const molRaw = Array.isArray(parsed) ? parsed[0] : parsed
    return mapMolecule(molRaw)
  }

  async listMolecules(): Promise<Molecule[]> {
    // Molecules are issues with mol-type metadata. We query via bd list with a
    // label filter or use bd mol list if available. For now, use bd list and
    // filter for issues that have molecule metadata.
    const raw = await this.run(['list', '--all', '-n', '0', '--json'])
    const items = this.parseArray<BdIssue & { mol_type?: string; formula_name?: string }>(raw)
    return items
      .filter((i) => i.mol_type !== undefined)
      .map(mapMolecule)
  }

  async showMolecule(id: MoleculeId): Promise<unknown> {
    const raw = await this.run(['mol', 'show', id, '--json'])
    return raw ? JSON.parse(raw) : null
  }

  // ── Gates ────────────────────────────────────────────────────────────────────

  async listGates(opts?: { open?: boolean }): Promise<Gate[]> {
    const args = ['gate', 'list', '--json']
    if (opts?.open === false) args.push('--all')
    const raw = await this.run(args)
    if (!raw || raw.trim() === 'null') return []
    const items = this.parseArray<BdGate>(raw)
    return items.map(mapGate)
  }

  async createGate(input: {
    issueId: IssueId
    type: GateType
    reason?: string
    awaitId?: string
  }): Promise<Gate> {
    const args = ['gate', 'create', input.issueId, '--type', input.type, '--json']
    if (input.reason) args.push('--reason', input.reason)
    if (input.awaitId) args.push('--await-id', input.awaitId)
    const raw = await this.run(args)
    const parsed = JSON.parse(raw)
    return mapGate(Array.isArray(parsed) ? parsed[0] : parsed)
  }

  async resolveGate(gateId: GateId): Promise<Gate> {
    const raw = await this.run(['gate', 'resolve', gateId, '--json'])
    const parsed = JSON.parse(raw)
    return mapGate(Array.isArray(parsed) ? parsed[0] : parsed)
  }

  // ── Audit ────────────────────────────────────────────────────────────────────

  async recordAudit(input: { actor: string; event: string; payload?: unknown }): Promise<void> {
    const args = ['audit', 'record', '--actor', input.actor, '--event', input.event]
    if (input.payload) args.push('--payload', JSON.stringify(input.payload))
    await this.run(args)
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private async run(args: string[], actorOverride?: string): Promise<string> {
    const actor = actorOverride ?? this.actor
    const finalArgs = actor ? ['--actor', actor, ...args] : args
    const { stdout } = await execFileAsync(this.bin, finalArgs, {
      cwd: this.projectDir,
      maxBuffer: 10 * 1024 * 1024,
    })
    return stdout.trim()
  }

  private parseArray<T>(raw: string): T[] {
    if (!raw || raw.trim() === 'null' || raw.trim() === '') return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  }

  private applyFilter(issues: Issue[], filter: IssueFilter): Issue[] {
    return issues.filter((i) => {
      if (filter.status && i.status !== filter.status) return false
      if (filter.type && i.type !== filter.type) return false
      if (filter.priority !== undefined && String(i.priority) !== String(filter.priority)) return false
      if (filter.assignee && i.assignee !== filter.assignee) return false
      if (filter.labels) {
        for (const l of filter.labels) {
          if (!i.labels.includes(l)) return false
        }
      }
      if (filter.parent && i.parentId !== filter.parent) return false
      return true
    })
  }

  private detectBd(): string {
    // Check common locations, fallback to PATH lookup
    const candidates = [
      '/opt/homebrew/bin/bd',
      path.join(process.env.HOME ?? '', '.local/bin/bd'),
    ]
    for (const c of candidates) {
      if (fs.existsSync(c)) return c
    }
    return 'bd'
  }
}
