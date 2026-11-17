import { createClient } from "@/lib/supabase/server";
import { isVerifiedPlatformAdmin } from "@/lib/platform-admin-access";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "limitless_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type AdminSession = {
  email: string;
  name: string;
  issuedAt: number;
  userId?: string;
  authMode?: "account";
};

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.LIMITLESS_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "development-only-change-this-secret")
  );
}

function configuredEmail() {
  return process.env.LIMITLESS_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "";
}

function configuredPassword() {
  return (
    process.env.LIMITLESS_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ""
  );
}

function sign(payload: string) {
  const secret = sessionSecret();
  if (!secret)
    throw new Error("Administrator session signing is not configured.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hasAdminCredentialsConfigured() {
  return Boolean(configuredEmail() && configuredPassword());
}

export function validateAdminLogin(email: string, password: string) {
  const expectedEmail = configuredEmail();
  const expectedPassword = configuredPassword();
  if (!expectedEmail || !expectedPassword) return false;
  return (
    safeEqual(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase()) &&
    safeEqual(password, expectedPassword)
  );
}

export function createSessionToken(session: AdminSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(
  token: string | undefined,
): AdminSession | null {
  if (!token || !sessionSecret()) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature || !safeEqual(signature, sign(payload)))
    return null;
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AdminSession;
    if (
      typeof session.email !== "string" ||
      typeof session.name !== "string" ||
      !Number.isFinite(session.issuedAt) ||
      session.issuedAt <= 0 ||
      session.issuedAt > Date.now() + 60_000
    )
      return null;
    if (Date.now() - session.issuedAt > SESSION_TTL_SECONDS * 1000) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const legacy = verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
  if (legacy) return legacy;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !(await isVerifiedPlatformAdmin(data.user || undefined)))
      return null;
    return {
      email: data.user!.email!,
      name: data.user!.email!.split("@")[0],
      userId: data.user!.id,
      authMode: "account" as const,
      issuedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export async function setAdminSession(session: AdminSession) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(session), {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
