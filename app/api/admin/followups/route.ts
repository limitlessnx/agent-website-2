import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createSequence, enrollLeads, updateEnrollment } from "@/lib/followup-control";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  try {
    const body = await request.json();
    if (body.type === "sequence") {
      const sequence = await createSequence(body);
      return NextResponse.json({ ok:true, sequence }, { status:201 });
    }
    if (body.type === "enroll") {
      const enrollments = await enrollLeads(body);
      return NextResponse.json({ ok:true, enrollments }, { status:201 });
    }
    return NextResponse.json({ error:"Unsupported follow-up action." }, { status:400 });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to save follow-up changes." }, { status:400 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  try {
    const body = await request.json();
    if (!body.id || !body.action) return NextResponse.json({ error:"Enrollment ID and action are required." }, { status:400 });
    const enrollment = await updateEnrollment(String(body.id), String(body.action), body.value ? String(body.value) : undefined);
    return NextResponse.json({ ok:true, enrollment:enrollment[0] || null });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to update enrollment." }, { status:400 });
  }
}
