import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function requireAutomationApiKey(request: NextRequest) {
  const expected = process.env.LIMITLESS_API_KEY || "";
  if (!expected) {
    return { ok: false, status: 500, message: "LIMITLESS_API_KEY is not configured." };
  }

  const provided =
    request.headers.get("x-limitless-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!provided || !safeEqual(provided, expected)) {
    return { ok: false, status: 401, message: "Unauthorized automation request." };
  }

  return { ok: true, status: 200, message: "OK" };
}
