/**
 * `ibr ask` — verdict-engine surface (v3 thesis Milestone 1).
 *
 * Maps a fixed-vocabulary question to a focused subset of rules, runs them
 * over a scanned page, and returns a token-minimal `AskResponse`. The agent
 * never sees raw element JSON — only a verdict plus minimal evidence per
 * finding.
 *
 * See: docs/strategy/v3-thesis.md
 *
 * M1 scope: three questions, three rule families. Closed vocabulary.
 */

import { scan } from './scan.js'
import type { RuleContext } from './rules/engine.js'
import { touchTargetRules } from './rules/touch-targets.js'
import { signalNoiseRules } from './design-system/principles/signal-noise.js'
import { loadDesignSystemConfig } from './design-system/index.js'
import { validateExtendedTokens } from './design-system/tokens/validator.js'
import type { EnhancedElement, Violation } from './schemas.js'
import type { TokenViolation } from './tokens.js'

// ── Public types ───────────────────────────────────────────────────────────────

export type Verdict = 'PASS' | 'FAIL' | 'WARN' | 'UNCERTAIN'

export interface Finding {
  verdict: Verdict
  rule: string
  summary: string
  element?: string
  evidence?: Record<string, unknown>
  fix?: string
  confidence?: number
}

export interface AskResponse {
  question: string
  verdict: Verdict
  findings: Finding[]
  truncated?: boolean
  meta: {
    engineVersion: string
    durationMs: number
    elementsScanned: number
    rulesRun: string[]
    /** When verdict is UNCERTAIN, list of supported question phrasings. */
    supportedQuestions?: string[]
  }
}

// ── Question vocabulary ────────────────────────────────────────────────────────
//
// Closed vocabulary by design. Each entry is a canonical question plus the
// rule subset it dispatches to. Aliases let the agent phrase the same intent
// differently. Unknown questions return UNCERTAIN with this list — never a
// best-effort guess that pretends to answer.

type QuestionKind = 'touch-target' | 'signal-noise' | 'token-compliance'

interface QuestionDef {
  kind: QuestionKind
  canonical: string
  aliases: RegExp[]
  severity: 'warn' | 'error'
}

const QUESTIONS: QuestionDef[] = [
  {
    kind: 'touch-target',
    canonical: 'is the touch-target compliant',
    aliases: [
      /touch[- ]?target/i,
      /minimum\s+(tap|button|target)\s+size/i,
      /\b44\s*px|\b24\s*px|\btap target\b/i,
    ],
    severity: 'warn',
  },
  {
    kind: 'signal-noise',
    canonical: 'do status indicators follow signal-to-noise',
    aliases: [
      /signal[- ]?(to[- ]?)?noise/i,
      /(status|badge|pill).*(background|color|noise)/i,
      /are status (badges|pills) okay/i,
      /do badges follow calm[- ]?precision/i,
    ],
    severity: 'error',
  },
  {
    kind: 'token-compliance',
    canonical: 'is design-system token compliance okay',
    aliases: [
      /design[- ]?system\s+token/i,
      /token\s+compliance/i,
      /off[- ]?(system|token)/i,
      /design tokens?\b/i,
    ],
    severity: 'warn',
  },
]

const SUPPORTED_QUESTIONS = QUESTIONS.map((q) => q.canonical)

function matchQuestion(input: string): QuestionDef | null {
  const normalised = input.trim()
  for (const def of QUESTIONS) {
    if (def.canonical === normalised) return def
    if (def.aliases.some((re) => re.test(normalised))) return def
  }
  return null
}

// ── Verdict aggregation ────────────────────────────────────────────────────────

function aggregateVerdict(findings: Finding[]): Verdict {
  if (findings.length === 0) return 'PASS'
  if (findings.some((f) => f.verdict === 'FAIL')) return 'FAIL'
  if (findings.some((f) => f.verdict === 'WARN')) return 'WARN'
  if (findings.some((f) => f.verdict === 'UNCERTAIN')) return 'UNCERTAIN'
  return 'PASS'
}

function violationToFinding(v: Violation, kindSeverity: 'warn' | 'error'): Finding {
  // Trim evidence to keep the response token-minimal. We carry only the
  // fields an agent needs to drill in: bounds and the canonical severity.
  const evidence: Record<string, unknown> = {}
  if (v.bounds) evidence.bounds = v.bounds
  return {
    verdict: kindSeverity === 'error' ? 'FAIL' : 'WARN',
    rule: v.ruleId,
    summary: v.message,
    element: v.element,
    evidence: Object.keys(evidence).length ? evidence : undefined,
    fix: v.fix,
  }
}

function tokenViolationToFinding(t: TokenViolation): Finding {
  return {
    verdict: t.severity === 'error' ? 'FAIL' : 'WARN',
    rule: `tokens/${t.property}`,
    summary: t.message,
    element: t.element,
    evidence: { expected: t.expected, actual: t.actual, property: t.property },
  }
}

// ── ask() — the engine entrypoint ──────────────────────────────────────────────

export interface AskOptions {
  /** CDP scan options. Forwarded to scan(url, ...). */
  viewport?: 'desktop' | 'mobile' | 'tablet'
  timeout?: number
  /** Cap findings to keep responses tight. Default 25. */
  maxFindings?: number
  /** Pre-scanned elements (skip CDP). Test/host-friendly. */
  preScannedElements?: EnhancedElement[]
  /** Override viewport metrics when supplying preScannedElements. */
  viewportMetrics?: { width: number; height: number }
  /** Project dir for design-system config lookup. Defaults to cwd. */
  projectDir?: string
}

const ENGINE_VERSION = '0.1.0-m1'

export async function ask(
  url: string,
  question: string,
  options: AskOptions = {},
): Promise<AskResponse> {
  const start = Date.now()
  const def = matchQuestion(question)

  if (!def) {
    return {
      question,
      verdict: 'UNCERTAIN',
      findings: [
        {
          verdict: 'UNCERTAIN',
          rule: 'ask/unsupported-question',
          summary: `Question is not in the supported vocabulary. Use one of: ${SUPPORTED_QUESTIONS.join('; ')}`,
        },
      ],
      meta: {
        engineVersion: ENGINE_VERSION,
        durationMs: Date.now() - start,
        elementsScanned: 0,
        rulesRun: [],
        supportedQuestions: SUPPORTED_QUESTIONS,
      },
    }
  }

  // Get elements: either supplied for tests, or via a fresh scan.
  let elements: EnhancedElement[]
  let viewportWidth: number
  let viewportHeight: number

  if (options.preScannedElements) {
    elements = options.preScannedElements
    viewportWidth = options.viewportMetrics?.width ?? 1280
    viewportHeight = options.viewportMetrics?.height ?? 800
  } else {
    const result = await scan(url, {
      viewport: options.viewport ?? 'desktop',
      timeout: options.timeout,
    })
    elements = result.elements.all
    viewportWidth = result.viewport.width
    viewportHeight = result.viewport.height
  }

  const context: RuleContext = {
    isMobile: viewportWidth < 768,
    viewportWidth,
    viewportHeight,
    url,
    allElements: elements,
  }

  const maxFindings = options.maxFindings ?? 25
  const findings: Finding[] = []
  const rulesRun: string[] = []
  let truncated = false

  if (def.kind === 'touch-target' || def.kind === 'signal-noise') {
    const targetRules = def.kind === 'touch-target' ? touchTargetRules : signalNoiseRules
    for (const r of targetRules) rulesRun.push(r.id)
    const violations: Violation[] = []
    for (const element of elements) {
      for (const rule of targetRules) {
        const v = rule.check(element, context)
        if (v) violations.push({ ...v, severity: def.severity })
      }
    }
    truncated = violations.length > maxFindings
    for (const v of violations.slice(0, maxFindings)) {
      findings.push(violationToFinding(v, def.severity))
    }
  } else if (def.kind === 'token-compliance') {
    const projectDir = options.projectDir ?? process.cwd()
    const config = await loadDesignSystemConfig(projectDir)
    if (!config) {
      // Honest UNCERTAIN — no config means we cannot answer this question.
      findings.push({
        verdict: 'UNCERTAIN',
        rule: 'tokens/no-config',
        summary:
          'No design-system config found. Initialise with `ibr design-system init` ' +
          'to define tokens, or skip this question.',
      })
    } else {
      rulesRun.push('tokens/extended')
      const tokens = config.tokens
      if (!tokens) {
        findings.push({
          verdict: 'UNCERTAIN',
          rule: 'tokens/no-tokens',
          summary: 'Design-system config exists but has no `tokens` defined.',
        })
      } else {
        const tokenViolations = validateExtendedTokens(elements, tokens, config.name ?? 'project')
        truncated = tokenViolations.length > maxFindings
        for (const t of tokenViolations.slice(0, maxFindings)) {
          findings.push(tokenViolationToFinding(t))
        }
      }
    }
  }

  return {
    question,
    verdict: aggregateVerdict(findings),
    findings,
    truncated: truncated || undefined,
    meta: {
      engineVersion: ENGINE_VERSION,
      durationMs: Date.now() - start,
      elementsScanned: elements.length,
      rulesRun,
    },
  }
}

// ── exports for tests / other modules ─────────────────────────────────────────

export const _internal = {
  matchQuestion,
  aggregateVerdict,
  violationToFinding,
  tokenViolationToFinding,
  SUPPORTED_QUESTIONS,
}
