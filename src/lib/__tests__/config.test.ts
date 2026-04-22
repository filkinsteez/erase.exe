import { describe, expect, it } from "vitest";
import { getDataConfig } from "../config";

describe("getDataConfig", () => {
  it("defaults to server mode with flags off", () => {
    const config = getDataConfig({} as NodeJS.ProcessEnv);
    expect(config.mode).toBe("server");
    expect(config.serverApiEnabled).toBe(true);
    expect(config.archiveUploadEnabled).toBe(false);
    expect(config.byoKeyEnabled).toBe(false);
  });

  it("parses mixed mode and enables both flags", () => {
    const config = getDataConfig({
      TWEET_DELETE_MODE: "mixed",
      TWEET_DELETE_ARCHIVE_UPLOAD_ENABLED: "1",
      TWEET_DELETE_BYO_KEY_ENABLED: "true"
    } as unknown as NodeJS.ProcessEnv);
    expect(config.mode).toBe("mixed");
    expect(config.serverApiEnabled).toBe(true);
    expect(config.archiveUploadEnabled).toBe(true);
    expect(config.byoKeyEnabled).toBe(true);
  });

  it("disables server API in user mode", () => {
    const config = getDataConfig({
      TWEET_DELETE_MODE: "user",
      TWEET_DELETE_ARCHIVE_UPLOAD_ENABLED: "1"
    } as unknown as NodeJS.ProcessEnv);
    expect(config.mode).toBe("user");
    expect(config.serverApiEnabled).toBe(false);
    expect(config.archiveUploadEnabled).toBe(true);
    expect(config.byoKeyEnabled).toBe(false);
  });

  it("treats unknown values as defaults", () => {
    const config = getDataConfig({
      TWEET_DELETE_MODE: "bogus",
      TWEET_DELETE_ARCHIVE_UPLOAD_ENABLED: "maybe",
      TWEET_DELETE_BYO_KEY_ENABLED: "0"
    } as unknown as NodeJS.ProcessEnv);
    expect(config.mode).toBe("server");
    expect(config.archiveUploadEnabled).toBe(false);
    expect(config.byoKeyEnabled).toBe(false);
  });
});
