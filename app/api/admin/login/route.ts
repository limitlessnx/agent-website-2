import { NextRequest, NextResponse } from "next/server";
import {
  clearAdminSession,
  setAdminSession,
  validateAdminLogin,
} from "@/lib/admin-auth";
import { clearClientSession, signInClient } from "@/lib/client-auth";
import {
  establishAccountSession,
  isVerifiedPlatformAdmin,
} from "@/lib/platform-admin-access";

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => ({}));
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password)
    return NextResponse.json(
      { ok: false, message: "Email and password are required." },
      { status: 400 },
    );
  // Preserve the existing recovery path until its owner explicitly retires it.
  if (validateAdminLogin(email, password)) {
    await setAdminSession({
      email,
      name: email.split("@")[0] || "Admin",
      issuedAt: Date.now(),
    });
    return NextResponse.json({ ok: true });
  }
  try {
    const auth = await signInClient(email, password);
    if (!(await isVerifiedPlatformAdmin(auth.user)))
      return NextResponse.json(
        {
          ok: false,
          message: "This account does not have super-admin access.",
        },
        { status: 403 },
      );
    await establishAccountSession(auth);
    await clearAdminSession();
    await clearClientSession();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Unable to sign in. Check your account credentials and try again.",
      },
      { status: 401 },
    );
  }
}
