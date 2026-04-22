import "server-only";

import { Redis } from "@upstash/redis";

let cached: Redis | null = null;
let missingWarned = false;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Returns an Upstash Redis client, or null if env vars are missing.
 * Callers are responsible for degrading gracefully (e.g. no-op rate limits in local dev).
 */
export function tryGetRedis(): Redis | null {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!missingWarned) {
      missingWarned = true;
      console.warn(
        "[redis] UPSTASH_REDIS_REST_URL/TOKEN not set. Rate limits and ephemeral state are disabled. Set them in .env.local before production."
      );
    }
    return null;
  }
  cached = new Redis({ url, token });
  return cached;
}

/** Strict variant: throws when Redis is not configured. Use only from paths that must have Redis. */
export function getRedis(): Redis {
  const redis = tryGetRedis();
  if (!redis) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required. Copy .env.example to .env.local."
    );
  }
  return redis;
}
