import { NextRequest, NextResponse } from "next/server";
import { verifyOnboardingAccessToken } from "@/lib/onboarding-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { createAdminClient } from "@/lib/supabase/admin";

type Submission = {
  id: string;
  organization_id: string | null;
  payment_status: string;
  access_token_hash: string;
  status: string;
  current_step: number;
  business_information: Record<string, unknown>;
  business_services: Record<string, unknown>;
  communication_details: Record<string, unknown>;
  automation_requirements: Record<string, unknown>;
  business_resources: Record<string, unknown>;
  review_confirmation: Record<string, unknown>;
  submitted_at: string | null;
  service_packages?: unknown;
};

async function authorize(request: NextRequest) {
  const onboardingId = request.headers.get("x-onboarding-id")?.trim() || "";
  const token = request.headers.get("x-onboarding-token")?.trim() || "";
  if (!onboardingId || !token) throw new Error("Onboarding access details are required.");

  const rows = await supabaseServerRequest<Submission[]>(
    `client_onboarding_submissions?select=id,organization_id,payment_status,access_token_hash,status,current_step,business_information,business_services,communication_details,automation_requirements,business_resources,review_confirmation,submitted_at,service_packages(id,name,slug)&id=eq.${encodeURIComponent(onboardingId)}&limit=1`,
  );
  const submission = rows[0];
  if (!submission || !verifyOnboardingAccessToken(token, submission.access_token_hash)) {
    throw new Error("Invalid onboarding access details.");
  }
  if (!["paid", "waived"].includes(submission.payment_status)) {
    throw new Error("Payment must be confirmed before onboarding can continue.");
  }
  return submission;
}

function safeStorageName(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "knowledge-document";
}

async function persistKnowledgeDocument(submission: Submission, input: Record<string, unknown>) {
  const knowledgeFile = input.knowledgeFile;
  if (!knowledgeFile) return input;

  let parsed: Record<string, unknown> | null = null;
  try {
    const candidate = typeof knowledgeFile === "string" ? JSON.parse(knowledgeFile) : knowledgeFile;
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      parsed = candidate as Record<string, unknown>;
    }
  } catch {
    parsed = null;
  }

  if (!parsed) return input;
  const contentBase64 = String(parsed.content_base64 || "").trim();
  if (!contentBase64) return input;

  const fileName = String(parsed.name || "knowledge-document.pdf").trim() || "knowledge-document.pdf";
  const mimeType = String(parsed.type || "application/octet-stream").trim() || "application/octet-stream";
  const bytes = Buffer.from(contentBase64, "base64");
  if (!bytes.length) throw new Error("The uploaded knowledge document is empty.");
  if (bytes.length > 50 * 1024 * 1024) throw new Error("The uploaded knowledge document exceeds the 50 MB limit.");

  const admin = createAdminClient();
  const bucket = "limitless-media";
  const storagePath = `onboarding/${submission.id}/knowledge-${safeStorageName(fileName)}`;
  const { error: uploadError } = await admin.storage.from(bucket).upload(storagePath, bytes, {
    contentType: mimeType,
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data: document, error: documentError } = await admin
    .from("client_onboarding_documents")
    .upsert({
      onboarding_id: submission.id,
      organization_id: submission.organization_id,
      document_type: "knowledge_document",
      file_name: fileName,
      storage_bucket: bucket,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: bytes.length,
      status: "ready",
      metadata: { source: "client_onboarding", uploaded_via: "business_resources" },
    }, { onConflict: "onboarding_id,storage_bucket,storage_path" })
    .select("id")
    .single();
  if (documentError) throw documentError;

  const sanitizedFile = {
    name: fileName,
    type: mimeType,
    size: bytes.length,
    document_id: document.id,
    stored: true,
  };

  return {
    ...input,
    knowledgeFile: JSON.stringify(sanitizedFile),
  };
}

export async function GET(request: NextRequest) {
  try {
    const submission = await authorize(request);
    const { access_token_hash: _hidden, ...safeSubmission } = submission;
    return NextResponse.json({ submission: safeSubmission });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load onboarding." }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const submission = await authorize(request);
    if (["submitted", "under_review", "provisioning", "internal_testing", "live"].includes(submission.status)) {
      return NextResponse.json({ error: "This onboarding submission can no longer be edited." }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const step = Number(body.step || 0);
    const rawData = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data as Record<string, unknown> : null;
    const fields: Record<number, string> = {
      1: "business_information",
      2: "business_services",
      3: "communication_details",
      4: "automation_requirements",
      5: "business_resources",
    };
    const field = fields[step];
    if (!field || !rawData) {
      return NextResponse.json({ error: "A valid onboarding step and data object are required." }, { status: 400 });
    }

    const data = step === 5 ? await persistKnowledgeDocument(submission, rawData) : rawData;
    const nextStep = Math.min(6, Math.max(submission.current_step, step + 1));
    const result = await supabaseServerRequest(
      `client_onboarding_submissions?id=eq.${encodeURIComponent(submission.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ [field]: data, current_step: nextStep, status: "draft", updated_at: new Date().toISOString() }),
      },
    );
    return NextResponse.json({ ok: true, currentStep: nextStep, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save onboarding." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const submission = await authorize(request);
    if (["submitted", "under_review", "provisioning", "internal_testing", "live"].includes(submission.status)) {
      return NextResponse.json({ error: "This onboarding submission has already been submitted." }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const confirmed = body.confirmed === true;
    if (!confirmed) return NextResponse.json({ error: "Review confirmation is required." }, { status: 400 });

    const requiredBusiness = submission.business_information || {};
    const requiredCommunication = submission.communication_details || {};
    if (!String(requiredBusiness.businessName || "").trim()) {
      return NextResponse.json({ error: "Business name is required before submission." }, { status: 400 });
    }
    if (!String(requiredCommunication.businessEmail || "").trim()) {
      return NextResponse.json({ error: "Business email is required before submission." }, { status: 400 });
    }

    const submittedAt = new Date().toISOString();
    const result = await supabaseServerRequest(
      `client_onboarding_submissions?id=eq.${encodeURIComponent(submission.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "submitted",
          current_step: 6,
          submitted_at: submittedAt,
          review_confirmation: { confirmed: true, confirmedAt: submittedAt },
          updated_at: submittedAt,
        }),
      },
    );
    await supabaseServerRequest("client_onboarding_status_events", {
      method: "POST",
      body: JSON.stringify({ onboarding_id: submission.id, from_status: submission.status, to_status: "submitted", changed_by: "client" }),
    });
    return NextResponse.json({ ok: true, status: "submitted", result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit onboarding." }, { status: 400 });
  }
}
