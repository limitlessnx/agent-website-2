import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { CommunicationOutcomeError, persistCommunicationOutcome } from "@/lib/runtime/communication-outcome";

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    return NextResponse.json(await persistCommunicationOutcome("voice_receptionist_v6", await request.json().catch(() => ({}))));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized.") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const code = error instanceof CommunicationOutcomeError ? error.code : "outcome_persistence_unavailable";
    return NextResponse.json({ ok: false, error: code, needs_attention: true, do_not_redispatch: true }, { status: error instanceof CommunicationOutcomeError ? error.status : 409 });
  }
}
