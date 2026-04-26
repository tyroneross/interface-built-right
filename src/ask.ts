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

// ── Streaming protocol (B1 / v3 thesis Shift 3) ───────────────────────────────
//
// askStream yields three event kinds in order:
//   { type: 'start',  question, engineVersion, supportedQuestions? }
//   { type: 'finding', ... } — repeated, one per finding, as the rule loop
//                              produces them. Agents can act / cancel mid-stream.
//   { type: 'end',     verdict, totalFindings, durationMs, truncated, rulesRun, elementsScanned }
//
// Wire-format on stdout (CLI --stream): NDJSON. One JSON object per line.

export type AskStreamEvent =
  | { type: 'start'; question: string; engineVersion: string; supportedQuestions?: string[] }
  | ({ type: 'finding' } & Finding)
  | {
      type: 'end'
      verdict: Verdict
      totalFindings: number
      durationMs: number
      truncated: boolean
      rulesRun: string[]
      elementsScanned: number
    }

export async function* askStream(
  url: string,
  question: string,
  options: AskOptions = {},
): AsyncGenerator<AskStreamEvent, void, void> {
  const start = Date.now()
  const def = matchQuestion(question)

  if (!def) {
    yield {
      type: 'start',
      question,
      engineVersion: ENGINE_VERSION,
      supportedQuestions: SUPPORTED_QUESTIONS,
    }
    yield {
      type: 'finding',
      verdict: 'UNCERTAIN',
      rule: 'ask/unsupported-question',
      summary: `Question is not in the supported vocabulary. Use one of: ${SUPPORTED_QUESTIONS.join('; ')}`,
    }
    yield {
      type: 'end',
      verdict: 'UNCERTAIN',
      totalFindings: 1,
      durationMs: Date.now() - start,
      truncated: false,
      rulesRun: [],
      elementsScanned: 0,
    }
    return
  }

  yield { type: 'start', question, engineVersion: ENGINE_VERSION }

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
  const rulesRun: string[] = []
  let emitted = 0
  let totalProduced = 0
  let aggregate: Verdict = 'PASS'

  function bumpVerdict(next: Verdict): void {
    if (aggregate === 'FAIL') return
    if (next === 'FAIL') aggregate = 'FAIL'
    else if (next === 'WARN') aggregate = 'WARN'
    else if (next === 'UNCERTAIN' && aggregate === 'PASS') aggregate = 'UNCERTAIN'
  }

  if (def.kind === 'touch-target' || def.kind === 'signal-noise') {
    const targetRules = def.kind === 'touch-target' ? touchTargetRules : signalNoiseRules
    for (const r of targetRules) rulesRun.push(r.id)

    outer: for (const element of elements) {
      for (const rule of targetRules) {
        const v = rule.check(element, context)
        if (!v) continue
        totalProduced++
        if (emitted < maxFindings) {
          const finding = violationToFinding({ ...v, severity: def.severity }, def.severity)
          bumpVerdict(finding.verdict)
          emitted++
          yield { type: 'finding', ...finding }
          // Streaming consumers can stop iteration to cancel further work.
          // We continue producing until maxFindings or all elements are exhausted.
        } else {
          // Past the cap: keep counting for `truncated` accuracy but stop yielding.
          break outer
        }
      }
    }
  } else if (def.kind === 'token-compliance') {
    const projectDir = options.projectDir ?? process.cwd()
    const config = await loadDesignSystemConfig(projectDir)
    if (!config) {
      const f: Finding = {
        verdict: 'UNCERTAIN',
        rule: 'tokens/no-config',
        summary:
          'No design-system config found. Initialise with `ibr design-system init` ' +
          'to define tokens, or skip this question.',
      }
      bumpVerdict(f.verdict)
      emitted++
      totalProduced++
      yield { type: 'finding', ...f }
    } else {
      rulesRun.push('tokens/extended')
      const tokens = config.tokens
      if (!tokens) {
        const f: Finding = {
          verdict: 'UNCERTAIN',
          rule: 'tokens/no-tokens',
          summary: 'Design-system config exists but has no `tokens` defined.',
        }
        bumpVerdict(f.verdict)
        emitted++
        totalProduced++
        yield { type: 'finding', ...f }
      } else {
        const tokenViolations = validateExtendedTokens(elements, tokens, config.name ?? 'project')
        for (const t of tokenViolations) {
          totalProduced++
          if (emitted >= maxFindings) continue
          const finding = tokenViolationToFinding(t)
          bumpVerdict(finding.verdict)
          emitted++
          yield { type: 'finding', ...finding }
        }
      }
    }
  }

  yield {
    type: 'end',
    verdict: aggregate,
    totalFindings: emitted,
    durationMs: Date.now() - start,
    truncated: totalProduced > emitted,
    rulesRun,
    elementsScanned: elements.length,
  }
}

// ── Blocking wrapper: consumes the stream into a single AskResponse. ─────────
// Existing callers continue to work without changes.

export async function ask(
  url: string,
  question: string,
  options: AskOptions = {},
): Promise<AskResponse> {
  const findings: Finding[] = []
  let endEvent:
    | Extract<AskStreamEvent, { type: 'end' }>
    | undefined
  let supportedQuestions: string[] | undefined

  for await (const event of askStream(url, question, options)) {
    if (event.type === 'finding') {
      const { type: _t, ...rest } = event
      findings.push(rest)
    } else if (event.type === 'start') {
      supportedQuestions = event.supportedQuestions
    } else if (event.type === 'end') {
      endEvent = event
    }
  }

  if (!endEvent) {
    // Defensive: should never happen — askStream always emits an `end` event.
    throw new Error('askStream did not emit an end event')
  }

  return {
    question,
    verdict: endEvent.verdict,
    findings,
    truncated: endEvent.truncated || undefined,
    meta: {
      engineVersion: ENGINE_VERSION,
      durationMs: endEvent.durationMs,
      elementsScanned: endEvent.elementsScanned,
      rulesRun: endEvent.rulesRun,
      ...(supportedQuestions ? { supportedQuestions } : {}),
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
