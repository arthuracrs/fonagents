import type { Response } from 'express'
import type { UiEvent, UiEventPort } from '@fonagents/core'

// Implements UiEventPort by broadcasting events to all connected SSE clients.
// Each client is an Express Response with SSE headers already set.
// The terminal adapter (future) would write to stdout; the discord adapter
// would post messages — same UiEventPort interface, different transport.
export class SseEventBus implements UiEventPort {
  private readonly clients = new Set<Response>()

  addClient(res: Response): void {
    this.clients.add(res)
  }

  removeClient(res: Response): void {
    this.clients.delete(res)
  }

  emit(event: UiEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`
    for (const client of this.clients) {
      try {
        client.write(data)
        const flushable = client as unknown as { flush?: () => void }
        flushable.flush?.()
      } catch {
        this.clients.delete(client)
      }
    }
  }

  get clientCount(): number {
    return this.clients.size
  }
}
