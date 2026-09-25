/**
 * CLI exit-code contract for `ibr` (T-01, exit-codes hardening).
 *
 * Before this, every command exited with a bare `process.exit(1)` for BOTH
 * "the page/comparison/test has a real problem" and "the tool itself
 * crashed" (exception, bad argument, Chrome launch failure, navigation
 * timeout). An agent running `ibr scan` in a loop had no way to tell a
 * verdict FAIL from a tool crash from the exit code alone — both were `1`.
 *
 *   0 = EXIT_PASS       — command completed, no issues found (verdict
 *                         PASS/MATCH, or a command with no pass/fail concept
 *                         that ran to completion).
 *   1 = EXIT_ISSUES     — command completed and found something to report:
 *                         a FAIL/ISSUES/PARTIAL verdict, a failed visual
 *                         comparison, a failed test/flow/interaction-
 *                         assertion run, a low consistency score, a
 *                         no-op interaction. This is a legitimate RESULT,
 *                         not a crash — the tool did its job correctly.
 *   2 = EXIT_TOOL_ERROR — the command did NOT complete its job: an
 *                         exception, a bad/missing argument, a missing
 *                         session/element/simulator/browser-server, a
 *                         navigation or Chrome-launch failure, a timeout,
 *                         or a commander parse error (unknown option,
 *                         missing required argument).
 *
 * Two documented exceptions keep their own, older exit-code contracts
 * rather than being folded into 0/1/2 (see src/bin/ibr.ts for both):
 *   - `native:request-permission` exits 77 (sysexits.h EX_NOPERM-style
 *     convention) when Accessibility permission is missing, distinct from
 *     a generic tool error so a caller can special-case "go grant
 *     permission" from "something broke".
 *   - `run-script` exits with the SANDBOXED SCRIPT's own exit code
 *     (`result.exitCode`, 0-255) rather than 0/1/2 — the invoked script
 *     defines its own success/failure semantics, not `ibr`'s.
 */
export const EXIT_PASS = 0;
export const EXIT_ISSUES = 1;
export const EXIT_TOOL_ERROR = 2;
