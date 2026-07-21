import { NextRequest, NextResponse } from "next/server";
import { hasAdminCredentialsConfigured, setAdminSession, validateAdminLogin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "");
  const password = String(body.password || "");

  if (!hasAdminCredentialsConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Admin login is not configured. Set LIMITLESS_ADMIN_EMAIL and LIMITLESS_ADMIN_PASSWORD." },
      { status: 500 },
    );
  }

  if (!validateAdminLogin(email, password)) {
    return NextResponse.json({ ok: false, message: "Invalid admin login." }, { status: 401 });
  }

  await setAdminSession({
    email,
    name: email.split("@")[0] || "Admin",
    issuedAt: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
