/**
 * ActionOutcome — the per-action feedback-loop contract (Increment 1, F-09).
 *
 * A driven action "succeeded" ONLY when an expected-outcome validator passed —
 * not merely because the underlying CDP/AX call did not throw. Every action
 * carries provenance (how the target was resolved, what we waited for) and, on
 * failure, structured evidence (before/after signatures, a diff, ranked
 * alternatives, an optional screenshot) so a later escalation layer can reason
 * about what went wrong.
 *
 * FROZEN at Wave 0 (chunk C0). This type is the shape the Increment-2
 * capture→replay→escalate spine consumes, and the shape E2-B / E3-E emit on the
 * wire. Extend `provenance` and `evidence`; never strip existing fields.
 *
 * Adoption timing: INTERNAL-ONLY at C0. The native controller returns it, but
 * the native MCP wire stays byte-identical in Wave 0. The native wire gains
 * `validator`/`evidence` at E2-B; the web wire at E3-E.
 */

/** A candidate the resolver considered but did not act on, ranked by score. */
export interface RankedCandidate {
  /** Accessible name / label of the candidate. */
  label: string;
  /** Semantic role (button, textbox, AXButton, …). */
  role: string;
  /** Stable identifier when the surface exposes one. */
  identifier?: string | null;
  /** Match score for the requested target (higher = closer). */
  score: number;
}

/**
 * Expected-outcome check. `success` on the enclosing ActionOutcome is true ONLY
 * when `passed` is true.
 */
export interface ActionValidator {
  /** What the caller expected to observe after the action. */
  expected: string;
  /** What was actually observed. */
  observed: string;
  /** Whether the observation satisfied the expectation. */
  passed: boolean;
}

/**
 * How the action's target was resolved and what post-action settling occurred.
 * Extend with new fields; existing consumers must keep working.
 */
export interface ActionProvenance {
  /** Resolution tier (e.g. 'identifier' | 'label' | 'value' | 'contains'). */
  tier?: string;
  /** Resolver confidence for the chosen element (0..1). */
  confidence?: number;
  /** Resolved AX/DOM path of the acted-on element, when available. */
  resolvedPath?: string;
  /** The post-action expectation the caller asked us to wait for, if any. */
  waitFor?: string;
  /** How the post-action wait resolved (e.g. 'waitFor-found' | 'tree-stable' | 'timeout'). */
  waitResult?: string;
}

/** Structured failure evidence — REQUIRED on failure, spine-ready. */
export interface ActionEvidence {
  /** Signature of the observed state before the action. */
  beforeSignature: string;
  /** Signature of the observed state after the action. */
  afterSignature: string;
  /** Human/diff summary of what changed (or did not). */
  diff: string;
  /** Ranked alternatives the resolver considered (≤10). */
  alternatives: RankedCandidate[];
  /** Optional base64 PNG capturing the failure state. */
  screenshotB64?: string;
}

/**
 * The outcome of a single driven action.
 *
 * `success` is true ONLY if `validator.passed` is true. On failure, `evidence`
 * is populated.
 */
export interface ActionOutcome {
  success: boolean;
  validator: ActionValidator;
  provenance: ActionProvenance;
  evidence?: ActionEvidence;
}

/**
 * Build an ActionOutcome for a capability the active backend does not yet
 * implement (keyboard/lifecycle/menu on RespawnBackend). Epic 2's DaemonBackend
 * replaces these with real outcomes; until then the controller surfaces a
 * structured, non-throwing "not implemented" result.
 */
export function notImplementedOutcome(capability: string): ActionOutcome {
  return {
    success: false,
    validator: {
      expected: `${capability} capability available`,
      observed: `${capability} not implemented by the active native backend`,
      passed: false,
    },
    provenance: {},
  };
}
