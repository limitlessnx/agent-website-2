import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "limitless_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type AdminSession = {
  email: string;
  name: string;
  issuedAt: number;
};

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.LIMITLESS_ADMIN_PASSWORD ||
    "development-only-change-this-secret"
  );
}

function configuredEmail() {
  return process.env.LIMITLESS_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "";
}

function configuredPassword() {
  return process.env.LIMITLESS_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
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

export function verifySessionToken(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!session.email || !session.issuedAt) return null;
    if (Date.now() - session.issuedAt > SESSION_TTL_SECONDS * 1000) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function setAdminSession(session: AdminSession) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
