/**
 * Resolution cache — auto-caching for intent → element mappings.
 * Inspired by Stagehand's selector auto-caching.
 *
 * When an intent resolves to an element, cache the mapping.
 * Next time the same intent appears, replay the cached resolution
 * without re-querying the AX tree. If replay fails (element gone),
 * re-resolve and update the cache.
 *
 * Stagehand reports 3-5x speed improvement from caching.
 */

export interface CachedResolution {
  /** The original intent string */
  intent: string
  /** Matched element's backendDOMNodeId-based ID */
  elementId: string
  /** Role of the matched element */
  role: string
  /** Label of the matched element */
  label: string
  /** Confidence of the original resolution */
  confidence: number
  /** When this cache entry was created */
  createdAt: number
  /** Number of successful cache hits */
  hits: number
  /** Last successful hit time */
  lastHit: number
}

export interface CacheOptions {
  /** Max cache entries (default: 100) */
  maxEntries?: number
  /** Cache entry TTL in ms (default: 5 minutes) */
  ttl?: number
  /** Minimum confidence to cache (default: 0.7) */
  minConfidence?: number
}

export class ResolutionCache {
  private cache = new Map<string, CachedResolution>()
  private maxEntries: number
  private ttl: number
  private minConfidence: number

  constructor(options: CacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 100
    this.ttl = options.ttl ?? 5 * 60 * 1000 // 5 minutes
    this.minConfidence = options.minConfidence ?? 0.7
  }

  /**
   * Look up a cached resolution for an intent.
   * Returns the cached elementId if found and not expired, null otherwise.
   */
  get(intent: string): CachedResolution | null {
    const key = this.normalizeKey(intent)
    const entry = this.cache.get(key)

    if (!entry) return null

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Record hit
    entry.hits++
    entry.lastHit = Date.now()
    return entry
  }

  /**
   * Cache a successful resolution.
   * Only caches if confidence meets threshold.
   */
  set(
    intent: string,
    elementId: string,
    metadata: { role: string; label: string; confidence: number },
  ): void {
    if (metadata.confidence < this.minConfidence) return

    const key = this.normalizeKey(intent)

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest()
    }

    this.cache.set(key, {
      intent,
      elementId,
      role: metadata.role,
      label: metadata.label,
      confidence: metadata.confidence,
      createdAt: Date.now(),
      hits: 0,
      lastHit: 0,
    })
  }

  /**
   * Invalidate a specific cache entry (e.g., when element is gone).
   */
  invalidate(intent: string): void {
    this.cache.delete(this.normalizeKey(intent))
  }

  /**
   * Clear all cache entries (e.g., after navigation).
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics.
   */
  stats(): {
    entries: number
    totalHits: number
    avgConfidence: number
  } {
    let totalHits = 0
    let totalConfidence = 0

    for (const entry of this.cache.values()) {
      totalHits += entry.hits
      totalConfidence += entry.confidence
    }

    return {
      entries: this.cache.size,
      totalHits,
      avgConfidence: this.cache.size > 0 ? totalConfidence / this.cache.size : 0,
    }
  }

  private normalizeKey(intent: string): string {
    return intent.toLowerCase().trim()
  }

  private evictOldest(): void {
    let oldest: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache) {
      const lastUsed = entry.lastHit || entry.createdAt
      if (lastUsed < oldestTime) {
        oldestTime = lastUsed
        oldest = key
      }
    }

    if (oldest) this.cache.delete(oldest)
  }
}
