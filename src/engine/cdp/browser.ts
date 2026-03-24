/**
 * Chrome browser process lifecycle management.
 * Forked from Spectra — adapted for IBR engine.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const CHROME_PATHS = [
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  // Windows (WSL)
  '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
]

export function findChrome(): string | null {
  for (const p of CHROME_PATHS) {
    if (existsSync(p)) return p
  }
  return null
}

export interface BrowserOptions {
  headless?: boolean    // default: true
  port?: number         // default: random ephemeral port
  userDataDir?: string  // default: ~/.ibr/chromium-profile/
  chromePath?: string   // override Chrome executable path
}

function randomPort(): number {
  return 49152 + Math.floor(Math.random() * (65535 - 49152))
}

export class BrowserManager {
  private process: ChildProcess | null = null
  private _port = 0

  async launch(options: BrowserOptions = {}): Promise<string> {
    const headless = options.headless ?? true
    this._port = options.port ?? randomPort()
    const userDataDir = options.userDataDir ?? join(homedir(), '.ibr', 'chromium-profile')

    const chromePath = options.chromePath ?? findChrome()
    if (!chromePath) {
      throw new Error(
        'Chrome not found. Install Google Chrome or pass chromePath option.\n'
        + `Checked: ${CHROME_PATHS.join(', ')}`
      )
    }

    await mkdir(userDataDir, { recursive: true })

    const args = [
      `--remote-debugging-port=${this._port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
    ]
    if (headless) {
      args.push('--headless=new')
    }

    this.process = spawn(chromePath, args, { stdio: 'pipe' })

    this.process.on('error', (err) => {
      console.error(`Chrome process error: ${err.message}`)
    })

    return this.waitForDebugger()
  }

  private async waitForDebugger(): Promise<string> {
    const maxAttempts = 50 // 5 seconds at 100ms intervals
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${this._port}/json/version`)
        const data = (await res.json()) as { webSocketDebuggerUrl: string }
        return data.webSocketDebuggerUrl
      } catch {
        await new Promise((r) => setTimeout(r, 100))
      }
    }
    throw new Error(
      `Chrome debugger did not respond within 5s on port ${this._port}. `
      + 'Is another Chrome instance using this port?'
    )
  }

  async close(): Promise<void> {
    if (!this.process) return

    const proc = this.process
    this.process = null

    // Wait for process to exit, with SIGKILL escalation
    await new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        // Escalate to SIGKILL after 3 seconds
        try { proc.kill('SIGKILL') } catch { /* already dead */ }
        resolve()
      }, 3000)

      proc.once('close', () => {
        clearTimeout(killTimer)
        resolve()
      })

      proc.kill('SIGTERM')
    })
  }

  get running(): boolean {
    return this.process !== null && !this.process.killed
  }

  get port(): number {
    return this._port
  }
}
