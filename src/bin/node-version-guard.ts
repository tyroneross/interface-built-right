import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { EXIT_TOOL_ERROR } from '../exit-codes.js'

const MIN_MAJOR = 20

function runHint(): string {
  try {
    const root = join(homedir(), '.nvm', 'versions', 'node')
    const best = readdirSync(root)
      .map((d) => ({ d, v: d.replace(/^v/, '').split('.').map(Number) }))
      .filter((x) => x.v[0] >= 22 && existsSync(join(root, x.d, 'bin', 'node')))
      .sort((a, b) => a.v[0] - b.v[0] || a.v[1] - b.v[1] || a.v[2] - b.v[2])
      .pop()
    if (best) return join(root, best.d, 'bin', 'node').replace(homedir(), '~')
  } catch { /* no nvm; fall through */ }
  return 'Node 22+'
}

/** Returns the error message when `version` (e.g. "v18.1.0") is too old, else null. */
export function checkNodeVersion(version: string): string | null {
  const major = Number(version.replace(/^v/, '').split('.')[0])
  if (major >= MIN_MAJOR) return null
  return `ibr needs Node ${MIN_MAJOR}+ (found v${version.replace(/^v/, '')}); run with ${runHint()}`
}

const message = checkNodeVersion(process.versions.node)
if (message) {
  process.stderr.write(message + '\n')
  process.exit(EXIT_TOOL_ERROR)
}
