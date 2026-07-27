import { NextRequest, NextResponse } from "next/server";
import { resendClientVerification } from "@/lib/client-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    await resendClientVerification(email);
    return NextResponse.json({ ok: true, message: "Verification email sent." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to resend verification email." },
      { status: 400 },
    );
  }
}
