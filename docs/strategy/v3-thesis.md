# IBR v3 — Verdict Engine Thesis

> Status: draft (2026-04-25). Anchors the architectural direction for the
> generation after the custom CDP engine. Supersedes
> `docs/_IBR-2.0-ARCHITECTURE-legacy.md` (Playwright-wrapper thinking).

## Bottom line

IBR today is a tree-extractor: scans return ~50KB of every-element JSON and
the LLM does the inference. v3 inverts that. The engine produces verdicts;
the LLM consults them. Token cost drops 10-20x. Accuracy rises because the
LLM stops hunting for needles in element haystacks. Meta's automation stack
was built for engineers running tests; v3 is built for agents making design
decisions, a lane Meta has never targeted.

## Why now

Three forcing functions:

1. **LLM agents are real consumers, not edge cases.** Most IBR usage in the
   last 90 days has been an LLM driving the tool, not a human. The output
   shape should follow.
2. **Token economics dominate.** A single dense scan eats a non-trivial
   fraction of a Claude Opus turn. Turning that into a 200-token verdict
   creates room for 10x more design checks per session.
3. **Custom CDP engine landed.** Owning the extraction pipeline is the
   prerequisite for moving judgement upstream. We have it now.

## What we cede to Meta (and shouldn't fight)

- Headless fleet automation. IDB plus their internal sim farm wins.
- Genetic-search crash detection. Sapienz is genuinely state of the art.
- Apple-private-framework depth. Years of compatibility work, not worth
  re-running.

## What we own (the new lane)

- **Design judgement.** Calm Precision, accessibility, design-system
  compliance, intent inference. Meta has zero automation here.
- **Agent-native protocol.** Verdict-shaped JSON, streaming, token-minimal.
- **Single-developer velocity.** One install, scan in seconds, no companion
  process.
- **Cross-platform coherence.** One verdict schema across web, iOS, macOS.
- **Modality fusion.** Pixels plus structure plus principles in one engine,
  one finding.

## The five shifts

### 1. Q-DSL replaces scan-dump

| | Today | v3 |
|---|---|---|
| Call | `ibr scan <url>` | `ibr ask <url> "<question>"` |
| Returns | ~50KB element tree | `{verdict, evidence[], ~500 tokens}` |
| LLM job | Parse, infer, judge | Read verdict, optionally drill |

Question grammar starts narrow and expands by use:

```
ibr ask "is the primary CTA touch-target compliant"
ibr ask "do form fields have accessible names"
ibr ask "is hierarchy consistent with calm-precision"
ibr ask "what is the page intent and confidence"
```

Out of band: `scan` stays for power users and migration, but it stops being
the default agent surface.

### 2. Judgement moves into the engine

Calm Precision rules, the design-system token validator, the a11y audit,
and intent classification all run inside the CDP engine. The engine returns
reasoned findings (verdict plus minimal evidence). The LLM does not consume
raw computed-style values to derive design conclusions.

Concrete: a finding looks like

```json
{
  "verdict": "FAIL",
  "rule": "calm-precision/signal-noise",
  "summary": "Status uses background pill, not text color",
  "element": "[data-testid=order-status]",
  "evidence": { "background": "rgb(220,38,38)", "expected": "text-color-only" },
  "fix": "Replace badge with text-red-600 font-medium"
}
```

Token weight: ~120 per finding. Compare to the current scan format
(~500-1000 per element, hundreds of elements per page).

### 3. Streaming partials

Replace the single 3-second blocking response with NDJSON over stdout (or
SSE on MCP). First finding in 50-500ms. The agent reads as findings stream,
cancels early when it has what it needs, drills into one without waiting
for the rest.

This pairs naturally with cancellable tool calls in the SDK.

### 4. On-device triage tier

A small local model (1B-3B params, on-device, sub-100ms) handles the cheap
classification work: page intent, section role, copy register, layout
genre. Reserve frontier models (Claude Opus, GPT-5.x) for hard judgement.
Cost reduction on routine scans is roughly an order of magnitude.

Verified: Apple Foundation Models on-device supports this on M-series
hardware with sub-50ms inference for short prompts. Linux/Windows fallback
is whatever local runtime the host provides; degrade gracefully to
frontier model.

### 5. Modality fusion at the source

Don't return CSS values for the LLM to interpret. Run image plus structure
together inside the engine and return a reasoned verdict:

> "Button reads as disabled. Contrast 2.3:1, opacity 0.5, no hover style.
> Likely unintended given parent context = primary action area."

200 tokens of conclusion versus 5KB of raw signals plus an LLM inference
hop today.

## Verdict schema (proposed)

```ts
type Verdict = "PASS" | "FAIL" | "WARN" | "UNCERTAIN";

interface Finding {
  verdict: Verdict;
  rule: string;            // namespaced: "calm-precision/signal-noise"
  summary: string;         // ≤140 chars, agent-readable
  element?: string;        // selector or AX path
  evidence?: Record<string, unknown>;  // minimal, ≤500 bytes
  fix?: string;            // suggested change, optional
  confidence?: number;     // 0..1, default 1.0
}

interface AskResponse {
  question: string;
  verdict: Verdict;        // aggregated
  findings: Finding[];     // ordered by severity
  truncated?: boolean;     // if findings limit hit
  meta: { engineVersion: string; durationMs: number; tokenBudget: number };
}
```

## Milestones

| | Deliverable | Verifiable by |
|---|---|---|
| **M1** | `ibr ask` command, three rules ported (calm-precision/signal-noise, a11y/touch-target, design-system/token-compliance), JSON output | Unit tests over fixture pages; agent eval on 10 hand-chosen URLs |
| **M2** | Streaming NDJSON output, MCP tool wired to stream | Latency: first finding under 500ms on local fixtures |
| **M3** | On-device triage classifier for page intent and section role | Accuracy ≥ 85% on labeled corpus of 200 pages; latency ≤ 100ms |
| **M4** | Modality fusion: screenshot plus structure feed one rule (start with disabled-state detection) | Manual eval on 50 buttons; precision ≥ 90% |
| **M5** | Cross-platform: same `ask` surface on iOS via the existing native AX extractor | Native fixture corpus; same verdict schema |

## Anti-goals

- Do not chase headless iOS fleet automation. Cede to IDB.
- Do not add a query language richer than necessary. Start with a fixed
  question vocabulary; expand only when token traffic shows demand.
- Do not pre-compute everything. Lazy, question-scoped extraction beats
  exhaustive scan even if the query overlaps work.
- Do not break the existing `scan` API in M1-M3. Migration is opt-in.
- Do not let "verdict engine" become a euphemism for shipping opinions
  without evidence. Every verdict carries traceable evidence or it does
  not ship.

## Open questions

- Does the on-device triage tier ship in-process (Foundation Models on
  Darwin) or as a sidecar (small Llama / Phi quant)?
- Is the question vocabulary closed (enum) or open (LLM-paraphrased to
  closest registered rule)? Closed is faster and more predictable; open
  is friendlier to agents.
- Where does the rule registry live? In-tree (versioned with engine) or
  pluggable (host-provided)? Pluggability is a tax we may not need yet.

## What this doc is not

Not a roadmap commitment. Not a sprint plan. An anchor: future sessions
should reference this when proposing extraction features, MCP tool
shapes, or output formats, and should justify any divergence.
