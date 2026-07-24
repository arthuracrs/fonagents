import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer, type Server } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { TaskService } from '@taskforge/core';
import type { ActorService } from '@taskforge/core';
import type { EventService } from '@taskforge/core';
import type { GateService } from '@taskforge/core';
import type { TemplateService } from '@taskforge/core';

export interface HttpServerServices {
  tasks: TaskService;
  actors: ActorService;
  events: EventService;
  gates: GateService;
  templates: TemplateService;
}

export class HttpServer {
  private readonly app = express();
  private readonly server: Server;
  private readonly wss: WebSocketServer;
  private readonly clients = new Set<WebSocket>();

  constructor(private readonly services: HttpServerServices) {
    this.app.use(express.json());
    this.app.use(this.requestLogger);
    this.app.use(this.corsMiddleware);
    this.setupRoutes();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server, path: '/api/events/stream' });
    this.setupWebSocket();
  }

  private requestLogger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
  }

  private corsMiddleware(_req: Request, res: Response, next: NextFunction): void {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  }

  private setupRoutes(): void {
    this.app.get('/api/tasks', this.listTasks);
    this.app.post('/api/tasks', this.createTask);
    this.app.get('/api/tasks/:id', this.getTask);
    this.app.patch('/api/tasks/:id', this.updateTask);
    this.app.delete('/api/tasks/:id', this.deleteTask);
    this.app.post('/api/tasks/:id/claim', this.claimTask);
    this.app.post('/api/tasks/:id/close', this.closeTask);
    this.app.post('/api/tasks/:id/reopen', this.reopenTask);
    this.app.post('/api/tasks/:id/comment', this.addComment);

    this.app.get('/api/actors', this.listActors);
    this.app.post('/api/actors', this.createActor);

    this.app.get('/api/events', this.listEvents);

    this.app.get('/api/gates', this.listGates);
    this.app.post('/api/gates', this.createGate);
    this.app.post('/api/gates/:id/resolve', this.resolveGate);

    this.app.get('/api/templates', this.listTemplates);
    this.app.get('/api/templates/:name', this.getTemplate);
    this.app.post('/api/templates', this.createTemplate);
    this.app.post('/api/templates/:name/pour', this.pourTemplate);
    this.app.delete('/api/templates/:name', this.deleteTemplate);

    this.app.use(this.errorHandler);
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
    });

    this.services.events.subscribe((event: any) => {
      const data = JSON.stringify(event);
      for (const client of this.clients) {
        if (client.readyState === 1) {
          client.send(data);
        }
      }
    });
  }

  private listTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, assignee, labels, type, priority, parentId, sort, limit, offset } = req.query;
      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      if (assignee) filter.assignee = assignee;
      if (labels) filter.labels = (labels as string).split(',');
      if (type) filter.type = type;
      if (priority !== undefined) filter.priority = Number(priority);
      if (parentId) filter.parentId = parentId;

      // Sort: comma-separated field:dir pairs (e.g. "priority:asc,createdAt:desc")
      if (sort) {
        filter.sort = (sort as string).split(',').map((part: string) => {
          const [field, dir] = part.split(':');
          return { field: field || 'createdAt', direction: (dir || 'desc') as 'asc' | 'desc' };
        });
      }

      if (limit !== undefined) filter.limit = Number(limit);
      if (offset !== undefined) filter.offset = Number(offset);

      const tasks = await this.services.tasks.list(filter as any);
      res.json(tasks);
    } catch (err) {
      next(err);
    }
  };

  private createTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title } = req.body;
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: 'title is required and must be a non-empty string' });
        return;
      }
      const task = await this.services.tasks.create(req.body);
      res.status(201).json(task);
    } catch (err) {
      next(err);
    }
  };

  private getTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const task = await this.services.tasks.get(req.params.id);
      res.json(task);
    } catch (err) {
      next(err);
    }
  };

  private updateTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const task = await this.services.tasks.update(req.params.id, req.body);
      res.json(task);
    } catch (err) {
      next(err);
    }
  };

  private deleteTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.services.tasks.close(req.params.id, 'Deleted');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  private claimTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { actorId } = req.body;
      if (!actorId) {
        res.status(400).json({ error: 'actorId is required' });
        return;
      }
      const task = await this.services.tasks.claim(req.params.id, actorId);
      res.json(task);
    } catch (err) {
      next(err);
    }
  };

  private closeTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const task = await this.services.tasks.close(req.params.id, req.body.reason);
      res.json(task);
    } catch (err) {
      next(err);
    }
  };

  private reopenTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const task = await this.services.tasks.reopen(req.params.id);
      res.json(task);
    } catch (err) {
      next(err);
    }
  };

  private addComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { actorId, body } = req.body;
      if (!actorId || !body) {
        res.status(400).json({ error: 'actorId and body are required' });
        return;
      }
      const event = await this.services.events.create(
        req.params.id,
        actorId,
        'commented',
        { body },
      );
      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  };

  private listActors = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actors = await this.services.actors.list();
      res.json(actors);
    } catch (err) {
      next(err);
    }
  };

  private createActor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = await this.services.actors.create(req.body);
      res.status(201).json(actor);
    } catch (err) {
      next(err);
    }
  };

  private listEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { taskId } = req.query;
      const events = await this.services.events.list(taskId as string | undefined);
      res.json(events);
    } catch (err) {
      next(err);
    }
  };

  private listGates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { taskId } = req.query;
      const gates = await this.services.gates.list(taskId as string | undefined);
      res.json(gates);
    } catch (err) {
      next(err);
    }
  };

  private createGate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { taskId, type, reason, awaitId } = req.body;
      if (!taskId || !type) {
        res.status(400).json({ error: 'taskId and type are required' });
        return;
      }
      const gate = await this.services.gates.create(taskId, type, reason, awaitId);
      res.status(201).json(gate);
    } catch (err) {
      next(err);
    }
  };

  private resolveGate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { resolvedBy } = req.body;
      if (!resolvedBy) {
        res.status(400).json({ error: 'resolvedBy is required' });
        return;
      }
      const gate = await this.services.gates.resolve(req.params.id, resolvedBy);
      res.json(gate);
    } catch (err) {
      next(err);
    }
  };

  private listTemplates = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const templates = await this.services.templates.list();
      res.json(templates);
    } catch (err) {
      next(err);
    }
  };

  private getTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const template = await this.services.templates.get(req.params.name);
      res.json(template);
    } catch (err) {
      next(err);
    }
  };

  private createTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const template = await this.services.templates.create(req.body);
      res.status(201).json(template);
    } catch (err) {
      next(err);
    }
  };

  private pourTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { vars } = req.body;
      if (!vars) {
        res.status(400).json({ error: 'vars is required' });
        return;
      }
      const tasks = await this.services.templates.pour(req.params.name, vars);
      res.status(201).json(tasks);
    } catch (err) {
      next(err);
    }
  };

  private deleteTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.services.templates.delete(req.params.name);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  private errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
    console.error(err);
    res.status(500).json({ error: err.message });
  }

  listen(port: number, callback?: () => void): void {
    this.server.listen(port, callback);
  }
}
