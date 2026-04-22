import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { tryGetRedis } from "./redis";

type Limiter = {
  check: (key: string) => Promise<{ success: boolean; remaining: number; reset: number }>;
};

function makeLimiter(requests: number, window: `${number} ${"s" | "m" | "h" | "d"}`): Limiter {
  let rl: Ratelimit | null = null;
  let redisAvailable: boolean | null = null;
  function get(): Ratelimit | null {
    if (rl) return rl;
    const redis = tryGetRedis();
    if (!redis) {
      redisAvailable = false;
      return null;
    }
    redisAvailable = true;
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, window),
      analytics: false,
      prefix: "rl:tweet-delete"
    });
    return rl;
  }
  return {
    async check(key: string) {
      const limiter = get();
      if (!limiter) {
        // Redis not configured — allow the request through. The warning is emitted once from tryGetRedis.
        void redisAvailable;
        void key;
        return { success: true, remaining: requests, reset: 0 };
      }
      const result = await limiter.limit(key);
      return { success: result.success, remaining: result.remaining, reset: result.reset };
    }
  };
}

/** Narrow, anonymous limiter used for unauthenticated routes keyed on IP. */
export const ipLimiter = makeLimiter(60, "1 m");

/** Per-account scan limiter. Scans are expensive and hit the X API. */
export const scanLimiter = makeLimiter(10, "1 h");

/** Per-account burn bag seal limiter. */
export const sealLimiter = makeLimiter(20, "10 m");

/** Per-account delete job creation limiter. Deletion is the most destructive path. */
export const deleteJobLimiter = makeLimiter(3, "1 h");

/** Per-account archive import limiter. Archive uploads are large. */
export const archiveLimiter = makeLimiter(5, "1 d");
