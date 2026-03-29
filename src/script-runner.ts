/**
 * Script Runner — safe execution of Python test scripts.
 * Sandboxed via resource limits (CPU, memory) and a temp directory.
 */

import { spawn } from 'child_process'
import { mkdir, writeFile, rm, copyFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

// ─── Public Types ─────────────────────────────────────────

export interface ScriptResult {
  exitCode: number
  stdout: string
  stderr: string
  /** Parsed JSON from stdout if valid, otherwise null */
  output: unknown
  duration: number
  timedOut: boolean
}

export interface RunScriptOptions {
  scriptPath: string
  url?: string
  /** Default 60000 (60s) */
  timeout?: number
  /** Default 512 */
  memoryMB?: number
  /** Default 30 */
  cpuSeconds?: number
  env?: Record<string, string>
}

// ─── Python resource-limit wrapper template ───────────────

function buildWrapper(scriptPath: string, cpuSeconds: number, memoryMB: number): string {
  // Resource limits are set inside the wrapper; on macOS RLIMIT_AS is
  // advisory only (macOS does not enforce virtual memory limits), but the
  // pattern is correct for Linux. We still set RLIMIT_CPU on both platforms.
  return `
import sys, os, resource, importlib.util

def _set_limits():
    cpu = ${cpuSeconds}
    mem = ${memoryMB} * 1024 * 1024
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
    except (ValueError, resource.error):
        pass
    try:
        resource.setrlimit(resource.RLIMIT_AS, (mem, mem))
    except (ValueError, resource.error):
        pass

_set_limits()

# Execute the user script in its own namespace
_script = ${JSON.stringify(scriptPath)}
_spec = importlib.util.spec_from_file_location("user_script", _script)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["user_script"] = _mod
_spec.loader.exec_module(_mod)
`
}

// ─── Main Runner ──────────────────────────────────────────

export async function runScript(options: RunScriptOptions): Promise<ScriptResult> {
  const {
    scriptPath,
    url,
    timeout = 60000,
    memoryMB = 512,
    cpuSeconds = 30,
    env = {},
  } = options

  // Create isolated temp directory
  const tmpId = randomBytes(8).toString('hex')
  const tmpDir = join(tmpdir(), `ibr-script-${tmpId}`)
  await mkdir(tmpDir, { recursive: true })

  const copiedScript = join(tmpDir, 'user_script.py')
  const wrapperPath = join(tmpDir, 'wrapper.py')

  try {
    await copyFile(scriptPath, copiedScript)
    await writeFile(wrapperPath, buildWrapper(copiedScript, cpuSeconds, memoryMB), 'utf-8')

    const start = Date.now()
    let timedOut = false
    let stdout = ''
    let stderr = ''
    let exitCode = 0

    await new Promise<void>((resolvePromise) => {
      const child = spawn('python3', [wrapperPath], {
        cwd: tmpDir,
        detached: true,
        shell: false,
        env: {
          ...process.env,
          ...(url ? { IBR_URL: url } : {}),
          IBR_SESSION_DIR: tmpDir,
          ...env,
        },
      })

      const killTimer = setTimeout(() => {
        timedOut = true
        try {
          // Kill the entire process group
          if (child.pid !== undefined) {
            process.kill(-child.pid, 'SIGKILL')
          }
        } catch {
          child.kill('SIGKILL')
        }
      }, timeout)

      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

      child.on('close', (code: number | null) => {
        clearTimeout(killTimer)
        exitCode = code ?? (timedOut ? 124 : 1)
        resolvePromise()
      })

      child.on('error', (err: Error) => {
        clearTimeout(killTimer)
        stderr += `\nProcess error: ${err.message}`
        exitCode = 1
        resolvePromise()
      })
    })

    const duration = Date.now() - start

    // Try to parse stdout as JSON
    let output: unknown = null
    const trimmed = stdout.trim()
    if (trimmed) {
      try {
        output = JSON.parse(trimmed)
      } catch {
        output = null
      }
    }

    return { exitCode, stdout, stderr, output, duration, timedOut }
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

// ─── Formatter ────────────────────────────────────────────

export function formatScriptResult(result: ScriptResult): string {
  const lines: string[] = []
  const verdict = result.exitCode === 0 ? 'PASS' : (result.timedOut ? 'TIMEOUT' : 'FAIL')
  lines.push(`[${verdict}] exit=${result.exitCode} duration=${result.duration}ms${result.timedOut ? ' (timed out)' : ''}`)
  if (result.stdout.trim()) {
    lines.push('stdout:')
    lines.push(result.stdout.trimEnd())
  }
  if (result.stderr.trim()) {
    lines.push('stderr:')
    lines.push(result.stderr.trimEnd())
  }
  return lines.join('\n')
}
