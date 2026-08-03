import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const { id } = await context.params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("automation_provisioning_jobs")
      .update({
        status: "queued",
        available_at: new Date().toISOString(),
        locked_at: null,
        started_at: null,
        completed_at: null,
        last_error: null,
      })
      .eq("id", id)
      .in("status", ["failed", "queued"])
      .select("id,status")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Job is not retryable." }, { status: 409 });
    return NextResponse.json({ job: data });
  } catch (error) {
    console.error("Automation provisioning retry failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retry provisioning job." }, { status: 500 });
  }
}
