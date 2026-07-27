import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

const CLIENT_COOKIE = "fluxknight_client_session";
const CLIENT_SESSION_TTL = 60 * 60 * 24 * 7;

type SupabaseAuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type SupabaseAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: SupabaseAuthUser;
  error?: string;
  error_description?: string;
  msg?: string;
};

export type ClientSession = {
  userId: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  membershipId: string;
  role: string;
  issuedAt: number;
};

type MembershipRow = {
  id: string;
  organization_id: string;
  status: string;
  organizations: { slug: string } | { slug: string }[] | null;
  membership_roles: Array<{ roles: { slug: string } | { slug: string }[] | null }>;
};

function projectRefFromUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;
    const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function projectRefFromKey(value: string) {
  if (!value || !value.includes(".")) return "";
  try {
    const payload = value.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { ref?: string };
    return String(decoded.ref || "");
  } catch {
    return "";
  }
}

function authConfig() {
  const url = (
    process.env.FLUXKNIGHT_SUPABASE_URL ||
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim().replace(/\/$/, "");

  const anonKey = (
    process.env.FLUXKNIGHT_SUPABASE_ANON_KEY ||
    process.env.LIMITLESS_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();

  if (!url || !anonKey) {
    throw new Error("Fluxknight authentication is not configured. Add the Limitless Realty Supabase URL and public key in Vercel Production settings.");
  }

  const urlProjectRef = projectRefFromUrl(url);
  const keyProjectRef = projectRefFromKey(anonKey);
  if (urlProjectRef && keyProjectRef && urlProjectRef !== keyProjectRef) {
    throw new Error(
      `Fluxknight Supabase configuration mismatch: the URL belongs to project ${urlProjectRef}, but the authentication key belongs to ${keyProjectRef}.`,
    );
  }

  return { url, anonKey, projectRef: urlProjectRef || keyProjectRef };
}

function sessionSecret() {
  return process.env.CLIENT_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.LIMITLESS_ADMIN_PASSWORD || "development-client-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

async function authRequest(path: string, body: Record<string, unknown>) {
  const { url, anonKey, projectRef } = authConfig();
  let response: Response;

  try {
    response = await fetch(`${url}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Fluxknight Supabase Auth connection failed", {
      projectRef,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Account creation is temporarily unavailable because Fluxknight could not reach its authentication service.");
  }

  const result = (await response.json().catch(() => ({}))) as SupabaseAuthResponse;
  if (!response.ok) throw new Error(result.error_description || result.msg || result.error || "Authentication failed.");
  return result;
}

export async function signUpClient(email: string, password: string, fullName: string) {
  return authRequest("signup", {
    email,
    password,
    data: { full_name: fullName },
  });
}

export async function signInClient(email: string, password: string) {
  return authRequest("token?grant_type=password", { email, password });
}

export async function getPrimaryMembership(userId: string) {
  const rows = await supabaseServerRequest<MembershipRow[]>(
    `organization_memberships?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=id,organization_id,status,organizations(slug),membership_roles(roles(slug))&limit=1`,
  );
  const membership = rows[0];
  if (!membership) return null;
  const organization = normalizeRelation(membership.organizations);
  const roleRelation = membership.membership_roles?.[0]?.roles || null;
  const role = normalizeRelation(roleRelation);
  return {
    membershipId: membership.id,
    organizationId: membership.organization_id,
    organizationSlug: organization?.slug || "",
    role: role?.slug || "member",
  };
}

export function createClientSessionToken(session: ClientSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyClientSessionToken(token?: string): ClientSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ClientSession;
    if (!session.userId || !session.organizationId || !session.issuedAt) return null;
    if (Date.now() - session.issuedAt > CLIENT_SESSION_TTL * 1000) return null;
    return session;
  } catch {
    return null;
  }
}

export async function setClientSession(session: ClientSession) {
  const store = await cookies();
  store.set(CLIENT_COOKIE, createClientSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: CLIENT_SESSION_TTL,
    path: "/",
  });
}

export async function getClientSession() {
  const store = await cookies();
  return verifyClientSessionToken(store.get(CLIENT_COOKIE)?.value);
}

export async function clearClientSession() {
  const store = await cookies();
  store.delete(CLIENT_COOKIE);
}
