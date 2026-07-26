import { NextResponse } from "next/server";
import { repairMaiaQuality } from "@/lib/maia-quality-repair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "maia-repair-7bc4";

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await repairMaiaQuality();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Maia quality repair failed." },
      { status: 500 },
    );
  }
}
