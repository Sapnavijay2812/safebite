// Fixed-window rate limiter. Process-local memory: adequate for a single-instance
// demo. For Cloud Run with several instances, replace the store with Redis or
// Firestore (see docs/GOOGLE_CLOUD.md) — the interface stays the same.

export interface RateDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Window {
  count: number;
  resetAt: number;
}

export function createRateLimiter(now: () => number = Date.now) {
  const windows = new Map<string, Window>();

  function sweep(current: number) {
    if (windows.size < 5000) return;
    for (const [key, value] of windows) {
      if (value.resetAt <= current) windows.delete(key);
    }
  }

  return {
    consume(key: string, limit: number, windowMs: number): RateDecision {
      const current = now();
      sweep(current);
      const existing = windows.get(key);
      const window: Window = existing && existing.resetAt > current ? existing : { count: 0, resetAt: current + windowMs };
      if (window.count >= limit) {
        windows.set(key, window);
        return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - current) / 1000)) };
      }
      window.count += 1;
      windows.set(key, window);
      return { allowed: true, remaining: limit - window.count, retryAfterSeconds: 0 };
    },
    reset() {
      windows.clear();
    },
  };
}

export const limiters = {
  ai: createRateLimiter(),
  reports: createRateLimiter(),
  uploads: createRateLimiter(),
};
