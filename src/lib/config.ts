export type DataMode = "server" | "user" | "mixed";

export type DataConfig = {
  mode: DataMode;
  serverApiEnabled: boolean;
  archiveUploadEnabled: boolean;
  byoKeyEnabled: boolean;
};

function parseMode(raw: string | undefined): DataMode {
  if (raw === "user" || raw === "mixed" || raw === "server") return raw;
  return "server";
}

function parseBoolFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function getDataConfig(env: NodeJS.ProcessEnv = process.env): DataConfig {
  const mode = parseMode(env.TWEET_DELETE_MODE);
  return {
    mode,
    serverApiEnabled: mode === "server" || mode === "mixed",
    archiveUploadEnabled: parseBoolFlag(env.TWEET_DELETE_ARCHIVE_UPLOAD_ENABLED),
    byoKeyEnabled: parseBoolFlag(env.TWEET_DELETE_BYO_KEY_ENABLED)
  };
}
