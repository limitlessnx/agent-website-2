import { timingSafeEqual } from "node:crypto";

export function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function assertRuntimeSecret(supplied: string | null) {
  const expected = process.env.RUNTIME_GATEWAY_SECRET || "";
  if (!expected || !secureEqual(expected, supplied || "")) {
    throw new Error("Unauthorized.");
  }
}
