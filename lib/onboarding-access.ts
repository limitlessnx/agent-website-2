import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createOnboardingAccessToken() {
  return randomBytes(32).toString("hex");
}

export function hashOnboardingAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyOnboardingAccessToken(token: string, expectedHash: string) {
  if (!token || !expectedHash) return false;

  const actual = Buffer.from(hashOnboardingAccessToken(token), "utf8");
  const expected = Buffer.from(expectedHash, "utf8");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
