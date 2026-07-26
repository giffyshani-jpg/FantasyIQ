// Provider Manager — Task 5: Multi-provider priority system.
//
// Implements a priority-based provider chain with:
//   - Reliability scoring (success rate + response time)
//   - Automatic retry with exponential back-off
//   - Provider health logging (integrates with provider-health.ts)
//   - Fallback chain: Provider A → Provider B → … → cached → null
//
// Usage:
//   const manager = createProviderManager([providerA, providerB], { retries: 2 });
//   const result = await manager.call(p => p.getLeagueOverview());

import { recordSuccess, recordFailure, getProviderHealth, ProviderHealthRecord } from "./provider-health";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NamedProvider {
  /** Unique provider identifier used for health tracking. */
  name: string;
  /** Optional static priority override (higher = tried first). */
  priority?: number;
}

export interface ProviderManagerOptions {
  /** Max retries per provider before moving to next. Default: 1 */
  retries?: number;
  /** Base delay in ms for exponential back-off. Default: 400 */
  retryBaseMs?: number;
  /** Timeout per attempt in ms. Default: 9000 */
  timeoutMs?: number;
  /** Min health score (0–1) below which a provider is skipped unless it's the last. Default: 0.2 */
  skipBelowScore?: number;
}

export interface ProviderCall<T, P extends NamedProvider> {
  (provider: P): Promise<T>;
}

// ─── Reliability score ────────────────────────────────────────────────────────

/**
 * Computes a 0–1 reliability score for a named provider.
 * Formula: success_rate (60%) + speed_bonus (40%)
 *   - success_rate = successCount / (successCount + failureCount)
 *   - speed_bonus  = clamp(1 - avgMs / 5000, 0, 1)  (0 = 5s+, 1 = instant)
 *
 * Unknown providers get 0.5 (benefit of the doubt).
 */
export function computeReliabilityScore(name: string): number {
  const rec: ProviderHealthRecord = getProviderHealth(name);
  const total = rec.successCount + rec.failureCount;
  if (total === 0) return 0.5; // unknown

  const successRate = rec.successCount / total;
  const avgMs = rec.successCount > 0 ? rec.totalResponseMs / rec.successCount : 5000;
  const speedBonus = Math.max(0, Math.min(1, 1 - avgMs / 5000));

  return successRate * 0.6 + speedBonus * 0.4;
}

// ─── Provider ranker ──────────────────────────────────────────────────────────

/**
 * Ranks providers by their effective priority:
 *   effective = (staticPriority ?? 0) * 0.5 + reliabilityScore * 0.5
 * Providers are returned highest-first.
 */
export function rankProviders<P extends NamedProvider>(providers: readonly P[]): P[] {
  return [...providers].sort((a, b) => {
    const scoreA = (a.priority ?? 0) * 0.5 + computeReliabilityScore(a.name) * 0.5;
    const scoreB = (b.priority ?? 0) * 0.5 + computeReliabilityScore(b.name) * 0.5;
    return scoreB - scoreA;
  });
}

// ─── Single-attempt helper ────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

async function attemptCall<T, P extends NamedProvider>(
  provider: P,
  fn: ProviderCall<T, P>,
  timeoutMs: number
): Promise<T> {
  const t0 = Date.now();
  try {
    const result = await withTimeout(fn(provider), timeoutMs);
    recordSuccess(provider.name, Date.now() - t0);
    return result;
  } catch (err) {
    recordFailure(provider.name, (err as Error)?.message ?? "unknown error");
    throw err;
  }
}

// ─── Provider manager factory ─────────────────────────────────────────────────

export interface ProviderManager<P extends NamedProvider> {
  /**
   * Calls fn against the highest-ranked available provider.
   * Retries on failure (up to options.retries per provider),
   * then falls back to the next provider in the chain.
   * Returns null if all providers fail.
   */
  call<T>(fn: ProviderCall<T, P>, fallback?: T): Promise<T | null>;

  /** Returns providers sorted by current reliability. */
  ranked(): P[];

  /** Log current provider health to console (debug). */
  logHealth(): void;
}

export function createProviderManager<P extends NamedProvider>(
  providers: readonly P[],
  options: ProviderManagerOptions = {}
): ProviderManager<P> {
  const {
    retries = 1,
    retryBaseMs = 400,
    timeoutMs = 9000,
    skipBelowScore = 0.2,
  } = options;

  return {
    async call<T>(fn: ProviderCall<T, P>, fallback?: T): Promise<T | null> {
      const ranked = rankProviders(providers);

      for (let pi = 0; pi < ranked.length; pi++) {
        const provider = ranked[pi];
        const score = computeReliabilityScore(provider.name);

        // Skip unreliable providers unless last resort
        if (score < skipBelowScore && pi < ranked.length - 1) {
          console.warn(`[provider-manager] Skipping ${provider.name} (score=${score.toFixed(2)})`);
          continue;
        }

        for (let attempt = 0; attempt <= retries; attempt++) {
          if (attempt > 0) {
            await delay(retryBaseMs * attempt);
          }
          try {
            const result = await attemptCall(provider, fn, timeoutMs);
            if (result !== null && result !== undefined) return result;
          } catch (err) {
            const msg = (err as Error)?.message ?? "unknown";
            // Don't retry 4xx errors — provider doesn't support this request
            if (msg.includes("4")) break;
            if (attempt < retries) {
              console.warn(`[provider-manager] ${provider.name} attempt ${attempt + 1} failed: ${msg}`);
            }
          }
        }
      }

      return fallback ?? null;
    },

    ranked(): P[] {
      return rankProviders(providers);
    },

    logHealth(): void {
      const ranked = rankProviders(providers);
      console.group("[provider-manager] Provider health");
      for (const p of ranked) {
        const score = computeReliabilityScore(p.name);
        const rec = getProviderHealth(p.name);
        console.log(
          `${p.name}: score=${score.toFixed(2)} ` +
          `ok=${rec.successCount} fail=${rec.failureCount} ` +
          `avgMs=${rec.successCount > 0 ? (rec.totalResponseMs / rec.successCount).toFixed(0) : "—"}`
        );
      }
      console.groupEnd();
    },
  };
}
