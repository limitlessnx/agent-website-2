import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function safeFileName(value: string) {
  return value.replace(/[\r\n"\\]/g, "_").trim() || "onboarding-document";
}

function parseLegacyFile(resources: unknown) {
  if (!resources || typeof resources !== "object" || Array.isArray(resources)) return null;
  const knowledgeFile = (resources as Record<string, unknown>).knowledgeFile;
  if (!knowledgeFile) return null;

  try {
    const parsed = typeof knowledgeFile === "string" ? JSON.parse(knowledgeFile) : knowledgeFile;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const file = parsed as Record<string, unknown>;
    const contentBase64 = String(file.content_base64 || "").trim();
    if (!contentBase64) return null;
    return {
      name: String(file.name || "onboarding-document.pdf"),
      mimeType: String(file.type || "application/octet-stream"),
      content: Buffer.from(contentBase64, "base64"),
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const onboardingId = request.nextUrl.searchParams.get("onboardingId")?.trim() || "";
  const download = request.nextUrl.searchParams.get("download") === "1";
  if (!onboardingId) return NextResponse.json({ error: "Onboarding ID is required." }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data: document, error: documentError } = await admin
      .from("client_onboarding_documents")
      .select("id,file_name,storage_bucket,storage_path,mime_type,status")
      .eq("onboarding_id", onboardingId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (documentError) throw documentError;

    if (document) {
      const { data, error } = await admin.storage.from(document.storage_bucket).download(document.storage_path);
      if (error) throw error;
      const bytes = Buffer.from(await data.arrayBuffer());
      const fileName = safeFileName(document.file_name || "onboarding-document");
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": document.mime_type || data.type || "application/octet-stream",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const { data: submission, error: submissionError } = await admin
      .from("client_onboarding_submissions")
      .select("id,business_resources")
      .eq("id", onboardingId)
      .maybeSingle();
    if (submissionError) throw submissionError;
    if (!submission) return NextResponse.json({ error: "Onboarding submission not found." }, { status: 404 });

    const legacy = parseLegacyFile(submission.business_resources);
    if (!legacy) return NextResponse.json({ error: "No onboarding document is available." }, { status: 404 });

    return new NextResponse(legacy.content, {
      headers: {
        "Content-Type": legacy.mimeType,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeFileName(legacy.name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load onboarding document." },
      { status: 500 },
    );
  }
}
