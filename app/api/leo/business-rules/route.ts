import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { createLeoBusinessRuleDraft, evaluateLeoBusinessRules, listLeoBusinessRules, setLeoBusinessRuleStatus } from "@/lib/leo-business-rules";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
  const rules = await listLeoBusinessRules(identity, includeInactive);
  return NextResponse.json({ ok: true, rules }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
    if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "evaluate").toLowerCase();
    if (action === "evaluate") return NextResponse.json(await evaluateLeoBusinessRules({ identity, workspace: body.workspace || undefined, organizationId: body.organizationId || body.organization_id || undefined }));
    if (action === "create_draft") return NextResponse.json({ ok: true, rule: await createLeoBusinessRuleDraft(identity, body.rule || body) }, { status: 201 });
    if (["publish","retire","draft"].includes(action)) {
      const id = String(body.ruleId || body.rule_id || "").trim(); if (!id) return NextResponse.json({ error: "ruleId is required." }, { status: 400 });
      const status = action === "publish" ? "active" : action === "retire" ? "retired" : "draft";
      return NextResponse.json({ ok: true, rule: await setLeoBusinessRuleStatus(identity, id, status) });
    }
    return NextResponse.json({ error: "Unsupported action. Use evaluate, create_draft, publish, retire or draft." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Business rule operation failed." }, { status: 500 });
  }
}
