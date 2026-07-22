import { EventEmitter } from 'events'
import type { Response } from 'express'
import type { UiEvent, UiEventPort } from '@fonagents/core'

export class SseEventBus implements UiEventPort {
  readonly events = new EventEmitter()
  private readonly clients = new Set<Response>()

  addClient(res: Response): void {
    this.clients.add(res)
  }

  removeClient(res: Response): void {
    this.clients.delete(res)
  }

  emit(event: UiEvent): void {
    // Emit to local listeners (like Overseer)
    this.events.emit('ui-event', event)

    // Broadcast to SSE clients
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
