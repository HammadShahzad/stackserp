/**
 * In-memory rate limiter for the public API v1.
 * Tracks requests per API key ID — 100 requests/minute default.
 * Stale entries are cleaned up every 2 minutes.
 */

interface RateBucket {
  count: number;
  resetAt: Date;
}

const store = new Map<string, RateBucket>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;
const CLEANUP_INTERVAL_MS = 120_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (bucket.resetAt.getTime() <= now) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow Node to exit even if the timer is still running
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export function checkRateLimit(keyId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
} {
  ensureCleanup();

  const now = Date.now();
  let bucket = store.get(keyId);

  if (!bucket || bucket.resetAt.getTime() <= now) {
    bucket = { count: 0, resetAt: new Date(now + WINDOW_MS) };
    store.set(keyId, bucket);
  }

  bucket.count++;

  if (bucket.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  return {
    allowed: true,
    remaining: MAX_REQUESTS - bucket.count,
    resetAt: bucket.resetAt,
  };
}
