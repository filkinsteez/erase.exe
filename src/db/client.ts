import "server-only";

import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __tweetDeletePostgres: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __tweetDeleteDb: PostgresJsDatabase<typeof schema> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env.local and point it at a Postgres instance."
    );
  }
  if (!globalThis.__tweetDeletePostgres) {
    globalThis.__tweetDeletePostgres = postgres(url, {
      max: 5,
      idle_timeout: 20,
      prepare: false
    });
  }
  return globalThis.__tweetDeletePostgres;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!globalThis.__tweetDeleteDb) {
    globalThis.__tweetDeleteDb = drizzle(createClient(), { schema });
  }
  return globalThis.__tweetDeleteDb;
}

export { schema };
export type Database = PostgresJsDatabase<typeof schema>;
