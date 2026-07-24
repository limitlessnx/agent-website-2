import { NextResponse } from "next/server";
import { clearClientSession } from "@/lib/client-auth";

export async function POST() {
  await clearClientSession();
  return NextResponse.json({ ok: true });
}
