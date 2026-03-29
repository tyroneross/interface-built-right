/**
 * SafariSession — manages the safaridriver process lifecycle.
 *
 * safaridriver is bundled with macOS. It requires a one-time setup:
 *   sudo safaridriver --enable
 *
 * Safari always runs in visible mode (no headless support).
 */

import { spawn, execFile, type ChildProcess } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const PORT_RANGE_START = 9500
const PORT_RANGE_END = 9599
const READY_POLL_INTERVAL_MS = 200
const READY_TIMEOUT_MS = 15000

export class SafariSession {
  private process: ChildProcess | null = null
  private port: number = PORT_RANGE_START

  // ─── Start ──────────────────────────────────────────────

  /**
   * Start safaridriver on the given port (or auto-find a free one).
   * Returns the port it's listening on.
   */
  async start(port?: number): Promise<number> {
    if (this.process) {
      return this.port
    }

    this.port = port ?? await this.findFreePort()

    this.process = spawn('safaridriver', ['--port', String(this.port)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.process.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.error(`[SafariSession] safaridriver exited with code ${code}`)
      }
      this.process = null
    })

    // Wait until safaridriver responds to /status
    await this.waitUntilReady()

    return this.port
  }

  // ─── Stop ───────────────────────────────────────────────

  async stop(): Promise<void> {
    if (!this.process) return
    this.process.kill('SIGTERM')
    // Give it a moment to exit
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.process?.kill('SIGKILL')
        resolve()
      }, 2000)
      this.process!.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
    this.process = null
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }

  // ─── Static: capability check ────────────────────────────

  /**
   * Returns true if safaridriver is enabled (one-time sudo setup was done).
   * Tests by trying to get safaridriver version — fails if not enabled.
   */
  static async isEnabled(): Promise<boolean> {
    try {
      await execFileAsync('safaridriver', ['--version'], { timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  // ─── Internals ───────────────────────────────────────────

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS
    const url = `http://localhost:${this.port}/status`

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url)
        if (res.ok) return
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, READY_POLL_INTERVAL_MS))
    }

    throw new Error(
      `safaridriver did not become ready on port ${this.port} within ${READY_TIMEOUT_MS}ms. ` +
      'Ensure "sudo safaridriver --enable" has been run.',
    )
  }

  private async findFreePort(): Promise<number> {
    const { createServer } = await import('net')

    for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
      const available = await new Promise<boolean>((resolve) => {
        const server = createServer()
        server.once('error', () => resolve(false))
        server.once('listening', () => { server.close(); resolve(true) })
        server.listen(p, '127.0.0.1')
      })
      if (available) return p
    }

    throw new Error(
      `No free port found in range ${PORT_RANGE_START}-${PORT_RANGE_END} for safaridriver`,
    )
  }
}
