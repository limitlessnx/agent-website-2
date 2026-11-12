import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { currentCrmIdentity } from "@/lib/leo-execution/authorization";
import { executionResult, principal } from "@/lib/leo-execution/contract";
import { loadExecution } from "@/lib/leo-execution/store";

export async function GET(request: NextRequest, context: { params: Promise<{ executionId: string }> }) {
  const identity = await resolveLeoIdentity({ allowPublic: false, request });
  if (!identity) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const row = await loadExecution((await context.params).executionId);
    if (row.principal !== principal(identity)) throw new Error("Execution is private to its initiating principal.");
    await currentCrmIdentity(identity, row.organization_id);
    const result = executionResult(row);
    // A stopped/crashed worker cannot establish completion; surface reconciliation explicitly.
    const overdue = ["pending_dispatch", "queued", "processing", "sending"].includes(row.status) && Date.now() > Date.parse(row.authorized_until);
    return NextResponse.json(overdue ? { ...result, ok: false, status: "reconciliation_required", error: "Execution deadline passed without a terminal result. Do not resend until reconciled." } : result,
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Execution not found or access denied." }, { status: 404 });
  }
}
