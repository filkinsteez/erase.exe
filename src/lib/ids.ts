import { randomUUID, randomBytes } from "crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function newOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
