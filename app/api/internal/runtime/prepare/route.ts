import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { runtimeSupabase } from "@/lib/runtime/supabase-types";
import { prepareExecutionWithoutDispatch } from "@/lib/runtime/worker";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const executionId = String(body.execution_id || "");
    if (!executionId) return NextResponse.json({ error: "execution_id is required." }, { status: 400 });

    const result = await prepareExecutionWithoutDispatch(runtimeSupabase(createAdminClient()), executionId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare runtime context.";
    const status = message === "Unauthorized." ? 401 : message === "Execution not found." ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
