import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { TaskForgeAdapter } from '@fonagents/taskforge-adapter'
import { Orchestrator } from '@fonagents/core'
import type { AgentRuntimePort } from '@fonagents/core'
import { SseEventBus, createHttpSseApp } from '@fonagents/http-sse-adapter'

function createMockRuntime(): AgentRuntimePort {
  return {
    listRuntimes: vi.fn(async () => [{ id: 'test', name: 'Test Runtime', version: '1.0' }]),
    spawnWorker: vi.fn(async () => ({
      id: 'worker-1',
      issueId: 'issue-1',
      status: 'running' as const,
      runtimeId: 'test',
      pid: 12345,
      startedAt: new Date().toISOString(),
    })),
    cancelWorker: vi.fn(async () => true),
    getWorker: vi.fn(() => undefined),
    listWorkers: vi.fn(() => []),
    getWorkersForIssue: vi.fn(() => []),
    subscribeWorker: vi.fn(() => ({ unsubscribe: vi.fn() })),
  }
}

describe('Integration: TaskForgeAdapter + HttpSseAdapter', () => {
  let adapter: TaskForgeAdapter
  let orchestrator: Orchestrator
  let app: ReturnType<typeof createHttpSseApp>['app']
  let runtime: AgentRuntimePort
  let eventBus: SseEventBus

  beforeEach(async () => {
    adapter = new TaskForgeAdapter({ dbPath: ':memory:' })
    runtime = createMockRuntime()
    eventBus = new SseEventBus()
    orchestrator = new Orchestrator(adapter, runtime, eventBus, {
      projectDir: '/tmp',
      managerRuntimeId: 'test',
    })
    const result = createHttpSseApp(orchestrator, orchestrator, eventBus, {
      port: 0,
      projectDir: '/tmp',
    })
    app = result.app
  })

  afterEach(async () => {
    await adapter.stopServer().catch(() => {})
  })

  // ── Adapter-level tests (no HTTP) ─────────────────────────────────────────────

  describe('TaskForgeAdapter (direct)', () => {
    it('should create and list issues', async () => {
      const issue = await adapter.createIssue({ title: 'Test Issue' })
      expect(issue.id).toBeDefined()
      expect(issue.title).toBe('Test Issue')
      expect(issue.status).toBe('open')

      const issues = await adapter.listIssues()
      expect(issues).toHaveLength(1)
      expect(issues[0].id).toBe(issue.id)
    })

    it('should create, claim, close, reopen', async () => {
      const issue = await adapter.createIssue({ title: 'Workflow' })
      const claimed = await adapter.claimIssue(issue.id, 'actor-1')
      expect(claimed.status).toBe('in_progress')
      expect(claimed.assignee).toBe('actor-1')

      const closed = await adapter.closeIssue(issue.id, 'Done')
      expect(closed.status).toBe('closed')

      const reopened = await adapter.reopenIssue(issue.id)
      expect(reopened.status).toBe('open')
    })

    it('should update issue fields', async () => {
      const issue = await adapter.createIssue({ title: 'Original', priority: 2 })
      const updated = await adapter.updateIssue(issue.id, { title: 'Updated', priority: 1 })
      expect(updated.title).toBe('Updated')
      expect(updated.priority).toBe(1)
    })

    it('should add and list comments', async () => {
      const issue = await adapter.createIssue({ title: 'Comments' })
      const comment = await adapter.addComment(issue.id, 'Hello', 'user-1')
      expect(comment.body).toBe('Hello')
      expect(comment.author).toBe('user-1')

      const comments = await adapter.listComments(issue.id)
      expect(comments).toHaveLength(1)
      expect(comments[0].body).toBe('Hello')
    })

    it('should add and list dependencies', async () => {
      const parent = await adapter.createIssue({ title: 'Parent' })
      const child = await adapter.createIssue({ title: 'Child' })
      await adapter.addDependency(child.id, parent.id)

      const deps = await adapter.listDependencies(child.id)
      expect(deps).toHaveLength(1)
      expect(deps[0].toId).toBe(parent.id)
    })

    it('should create and resolve gates', async () => {
      const issue = await adapter.createIssue({ title: 'Gated' })
      const gate = await adapter.createGate({ issueId: issue.id, type: 'human', reason: 'Needs review' })
      expect(gate.id).toBeDefined()
      expect(gate.status).toBe('open')

      const resolved = await adapter.resolveGate(gate.id)
      expect(resolved.status).toBe('closed')
    })

    it('should list gates', async () => {
      const issue = await adapter.createIssue({ title: 'Gates test' })
      await adapter.createGate({ issueId: issue.id, type: 'human', reason: 'Review' })
      const gates = await adapter.listGates()
      expect(gates).toHaveLength(1)
      expect(gates[0].issueId).toBe(issue.id)
    })

    it('should record audit events', async () => {
      await expect(
        adapter.recordAudit({ actor: 'system', event: 'test', payload: { ok: true } })
      ).resolves.toBeUndefined()
    })

    it('should return ready work (open, no blockers)', async () => {
      const issue = await adapter.createIssue({ title: 'Ready' })
      await adapter.createIssue({ title: 'Blocked', deps: [issue.id] })
      const ready = await adapter.readyWork()
      expect(ready).toHaveLength(1)
      expect(ready[0].title).toBe('Ready')
    })

    it('should get issue children', async () => {
      const parent = await adapter.createIssue({ title: 'Parent' })
      await adapter.createIssue({ title: 'Child 1', parent: parent.id })
      await adapter.createIssue({ title: 'Child 2', parent: parent.id })
      const kids = await adapter.children(parent.id)
      expect(kids).toHaveLength(2)
    })
  })

  // ── HTTP-level tests ─────────────────────────────────────────────────────────

  describe('HTTP API (via HttpSseAdapter)', () => {
    it('GET /api/issues should list issues', async () => {
      await adapter.createIssue({ title: 'Issue A' })
      await adapter.createIssue({ title: 'Issue B' })

      const res = await request(app).get('/api/issues').expect(200)
      expect(res.body).toHaveLength(2)
      expect(res.body.map((i: any) => i.title).sort()).toEqual(['Issue A', 'Issue B'])
    })

    it('POST /api/issues should create an issue', async () => {
      const res = await request(app)
        .post('/api/issues')
        .send({ title: 'New Issue' })
        .expect(200)
      expect(res.body.id).toBeDefined()
      expect(res.body.title).toBe('New Issue')
      expect(res.body.status).toBe('open')
    })

    it('POST /api/issues should require title', async () => {
      const res = await request(app)
        .post('/api/issues')
        .send({})
        .expect(400)
      expect(res.body.error).toBe('title is required')
    })

    it('GET /api/issues/:id should get an issue', async () => {
      const created = await adapter.createIssue({ title: 'Get me' })
      const res = await request(app).get(`/api/issues/${created.id}`).expect(200)
      expect(res.body.title).toBe('Get me')
    })

    it('GET /api/issues/:id should 404 for missing issue', async () => {
      const res = await request(app).get('/api/issues/nonexistent').expect(404)
      expect(res.body.error).toBe('Not found')
    })

    it('PATCH /api/issues/:id should update an issue', async () => {
      const created = await adapter.createIssue({ title: 'Before' })
      const res = await request(app)
        .patch(`/api/issues/${created.id}`)
        .send({ title: 'After' })
        .expect(200)
      expect(res.body.title).toBe('After')
    })

    it('POST /api/issues/:id/close should close an issue', async () => {
      const created = await adapter.createIssue({ title: 'Close me' })
      const res = await request(app)
        .post(`/api/issues/${created.id}/close`)
        .send({ reason: 'Finished' })
        .expect(200)
      expect(res.body.status).toBe('closed')
    })

    it('POST /api/issues/:id/reopen should reopen an issue', async () => {
      const created = await adapter.createIssue({ title: 'Reopen me' })
      await adapter.closeIssue(created.id)
      const res = await request(app)
        .post(`/api/issues/${created.id}/reopen`)
        .expect(200)
      expect(res.body.status).toBe('open')
    })

    it('POST /api/issues/:id/claim should claim an issue', async () => {
      const created = await adapter.createIssue({ title: 'Claim me' })
      const res = await request(app)
        .post(`/api/issues/${created.id}/claim`)
        .expect(200)
      expect(res.body.status).toBe('in_progress')
    })

    it('POST /api/issues/:id/comment should add a comment', async () => {
      const created = await adapter.createIssue({ title: 'Comment me' })
      const res = await request(app)
        .post(`/api/issues/${created.id}/comment`)
        .send({ body: 'Nice work' })
        .expect(200)
      expect(res.body.body).toBe('Nice work')
    })

    it('POST /api/issues/:id/comment should require body', async () => {
      const created = await adapter.createIssue({ title: 'No comment' })
      await request(app)
        .post(`/api/issues/${created.id}/comment`)
        .send({})
        .expect(400)
    })

    it('GET /api/issues/:id/comments should list comments', async () => {
      const created = await adapter.createIssue({ title: 'Comments' })
      await adapter.addComment(created.id, 'First!', 'user-1')
      const res = await request(app)
        .get(`/api/issues/${created.id}/comments`)
        .expect(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].body).toBe('First!')
    })

    it('GET /api/issues/:id/deps should list dependencies', async () => {
      const parent = await adapter.createIssue({ title: 'Parent' })
      const child = await adapter.createIssue({ title: 'Child' })
      await adapter.addDependency(child.id, parent.id)
      const res = await request(app)
        .get(`/api/issues/${child.id}/deps`)
        .expect(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].toId).toBe(parent.id)
    })

    it('POST /api/deps should add a dependency', async () => {
      const parent = await adapter.createIssue({ title: 'P' })
      const child = await adapter.createIssue({ title: 'C' })
      const res = await request(app)
        .post('/api/deps')
        .send({ child: child.id, parent: parent.id })
        .expect(200)
      expect(res.body.ok).toBe(true)
    })

    it('GET /api/issues/stats should return stats', async () => {
      const issue = await adapter.createIssue({ title: 'S' })
      await adapter.closeIssue(issue.id)
      const res = await request(app).get('/api/issues/stats').expect(200)
      expect(res.body.summary.total_issues).toBe(1)
      expect(res.body.summary.closed_issues).toBe(1)
    })

    it('GET /api/gates should list gates', async () => {
      const issue = await adapter.createIssue({ title: 'G' })
      await adapter.createGate({ issueId: issue.id, type: 'human' })
      const res = await request(app).get('/api/gates').expect(200)
      expect(res.body).toHaveLength(1)
    })

    it('POST /api/gates/:id/resolve should resolve a gate', async () => {
      const issue = await adapter.createIssue({ title: 'G' })
      const gate = await adapter.createGate({ issueId: issue.id, type: 'human' })
      const res = await request(app)
        .post(`/api/gates/${gate.id}/resolve`)
        .send({ note: 'Approved' })
        .expect(200)
      expect(res.body.ok).toBe(true)
    })

    it('GET /api/graph should return dependency graph', async () => {
      const a = await adapter.createIssue({ title: 'A' })
      const b = await adapter.createIssue({ title: 'B' })
      await adapter.addDependency(b.id, a.id)
      const res = await request(app).get('/api/graph').expect(200)
      expect(res.body.issues).toHaveLength(2)
    })

    it('GET /api/workers should list workers', async () => {
      const res = await request(app).get('/api/workers').expect(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('GET /api/runtimes should list runtimes', async () => {
      const res = await request(app).get('/api/runtimes').expect(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].id).toBe('test')
    })

    it('POST /api/executions should start a worker', async () => {
      const issue = await adapter.createIssue({ title: 'Exec' })
      const res = await request(app)
        .post('/api/executions')
        .send({ issueId: issue.id, runtimeId: 'test', prompt: 'Do it' })
        .expect(200)
      expect(res.body.status).toBe('running')
    })

    it('GET /api/executions/issue/:id should return executions', async () => {
      const issue = await adapter.createIssue({ title: 'E' })
      const res = await request(app)
        .get(`/api/executions/issue/${issue.id}`)
        .expect(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('GET /api/triggers/issue/:id should return triggers', async () => {
      const issue = await adapter.createIssue({ title: 'T' })
      const res = await request(app)
        .get(`/api/triggers/issue/${issue.id}`)
        .expect(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('GET /api/init-status should return init status', async () => {
      const res = await request(app).get('/api/init-status').expect(200)
      expect(res.body).toHaveProperty('initialized')
    })

    it('should filter issues by status via query param', async () => {
      const issue = await adapter.createIssue({ title: 'Filter me' })
      await adapter.closeIssue(issue.id)

      const openRes = await request(app).get('/api/issues?status=open').expect(200)
      expect(openRes.body.every((i: any) => i.status === 'open')).toBe(true)
    })

    it('should filter issues by type', async () => {
      await adapter.createIssue({ title: 'Bug', type: 'bug' })
      await adapter.createIssue({ title: 'Feature', type: 'feature' })

      const res = await request(app).get('/api/issues?type=bug').expect(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].title).toBe('Bug')
    })
  })

  // ── MCP tool endpoint tests ──────────────────────────────────────────────────

  describe('MCP tool endpoint', () => {
    it('POST /api/mcp/tools/dispatchWorker should dispatch a worker', async () => {
      const issue = await adapter.createIssue({ title: 'MCP Dispatch' })
      const res = await request(app)
        .post('/api/mcp/tools/dispatchWorker')
        .send({ issueId: issue.id, runtimeId: 'test' })
      expect(res.status).toBe(200)
    })

    it('POST /api/mcp/tools/listReady should call listReady', async () => {
      const res = await request(app)
        .post('/api/mcp/tools/listReady')
        .send({})
      expect(res.status).toBe(200)
    })

    it('POST /api/mcp/tools/overseerStatus should call overseerStatus', async () => {
      const res = await request(app)
        .post('/api/mcp/tools/overseerStatus')
        .send({})
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('enabled')
    })

    it('POST /api/mcp/tools/recordProgress should add a comment and return it', async () => {
      const issue = await adapter.createIssue({ title: 'Progress' })
      const res = await request(app)
        .post('/api/mcp/tools/recordProgress')
        .send({ issueId: issue.id, body: 'Working on it' })
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('id')
      expect(res.body).toHaveProperty('body', 'Working on it')
      const comments = await adapter.listComments(issue.id)
      expect(comments).toHaveLength(1)
    })

    it('POST /api/mcp/tools/completeTask should close the task and return a result', async () => {
      const issue = await adapter.createIssue({ title: 'Finish me' })
      const res = await request(app)
        .post('/api/mcp/tools/completeTask')
        .send({ taskId: issue.id, reason: 'Done' })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ ok: true, issueId: issue.id, status: 'closed' })
      const closed = await adapter.getIssue(issue.id)
      expect(closed?.status).toBe('closed')
    })

    it('POST /api/mcp/tools/unknown should return 500', async () => {
      const res = await request(app)
        .post('/api/mcp/tools/unknown')
        .send({})
      expect(res.status).toBe(500)
    })
  })

  // ── Edge cases ───────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should handle empty task list', async () => {
      const res = await request(app).get('/api/issues').expect(200)
      expect(res.body).toEqual([])
    })

    it('should handle special characters in titles', async () => {
      const issue = await adapter.createIssue({ title: 'Test "quotes" & <tags>' })
      const res = await request(app).get(`/api/issues/${issue.id}`).expect(200)
      expect(res.body.title).toBe('Test "quotes" & <tags>')
    })

    it('should handle concurrent issue creation', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        adapter.createIssue({ title: `Concurrent ${i}` })
      )
      const issues = await Promise.all(promises)
      expect(issues).toHaveLength(5)

      const res = await request(app).get('/api/issues').expect(200)
      expect(res.body).toHaveLength(5)
    })
  })
})
