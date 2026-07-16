#!/usr/bin/env node
import { startDaemon } from './daemon.js'
import { exec } from 'child_process'
import net from 'net'
import path from 'path'

function findFreePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(start, () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolve(port))
    })
    server.on('error', () => findFreePort(start + 1).then(resolve, reject))
  })
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
      ? `start "" "${url}"`
      : `xdg-open "${url}"`
  exec(cmd)
}

async function main() {
  const port = await findFreePort(parseInt(process.env.PORT ?? '3001', 10))

  startDaemon({ port })

  setTimeout(() => {
    const url = `http://localhost:${port}`
    console.log(`Opening ${url}`)
    openBrowser(url)
  }, 800)
}

main()
