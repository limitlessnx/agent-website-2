import { NextRequest, NextResponse } from "next/server";
import { verifyOnboardingAccessToken } from "@/lib/onboarding-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type Submission = {
  id: string;
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
    `client_onboarding_submissions?select=id,payment_status,access_token_hash,status,current_step,business_information,business_services,communication_details,automation_requirements,business_resources,review_confirmation,submitted_at,service_packages(id,name,slug)&id=eq.${encodeURIComponent(onboardingId)}&limit=1`,
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
    const data = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : null;
    const fields: Record<number, string> = {
      1: "business_information",
      2: "business_services",
      3: "communication_details",
      4: "automation_requirements",
      5: "business_resources",
    };
    const field = fields[step];
    if (!field || !data) {
      return NextResponse.json({ error: "A valid onboarding step and data object are required." }, { status: 400 });
    }

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
