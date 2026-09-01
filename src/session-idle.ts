/** Default idle lifetime for IBR-owned persistent browser sessions. */
export const DEFAULT_SESSION_IDLE_MS = 60 * 60 * 1000

/**
 * Resolve the persistent-session idle threshold.
 *
 * One hour bounds abandoned browsers without interrupting ordinary short
 * validation flows. Set `IBR_SESSION_IDLE_MS=0` to disable cleanup or provide
 * another non-negative millisecond value.
 */
export function configuredSessionIdleMs(env: NodeJS.ProcessEnv = process.env): number {
  const configured = env.IBR_SESSION_IDLE_MS
  if (configured === undefined || configured.trim() === '') return DEFAULT_SESSION_IDLE_MS
  const raw = Number(configured)
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_SESSION_IDLE_MS
}
