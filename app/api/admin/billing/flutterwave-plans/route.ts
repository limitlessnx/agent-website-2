import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { flutterwaveRequest } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

type BillingPlanRow = {
  id: string;
  slug: string;
  name: string;
  recurring_fee: number;
  metadata: Record<string, unknown> | null;
};

type FlutterwavePlan = {
  id: number;
  name: string;
  amount: number | string;
  interval: string;
  duration: number;
  status: string;
  currency: string;
};

type FlutterwavePlansResponse = {
  status: string;
  data?: FlutterwavePlan[];
  meta?: { page_info?: { total_pages?: number } };
};

type FlutterwaveCreateResponse = {
  status: string;
  data?: FlutterwavePlan;
};

const PLAN_DEFINITIONS = [
  { slug: "whatsapp-ai-starter", label: "Basic", currency: "NGN", amount: 50000, key: "ngn" },
  { slug: "whatsapp-ai-starter", label: "Basic", currency: "USD", amount: 200, key: "usd" },
  { slug: "ai-call-receptionist", label: "Plus", currency: "NGN", amount: 100000, key: "ngn" },
  { slug: "ai-call-receptionist", label: "Plus", currency: "USD", amount: 350, key: "usd" },
  { slug: "ai-front-desk-suite", label: "Business", currency: "NGN", amount: 250000, key: "ngn" },
  { slug: "ai-front-desk-suite", label: "Business", currency: "USD", amount: 700, key: "usd" },
] as const;

function isMatchingPlan(plan: FlutterwavePlan, expected: (typeof PLAN_DEFINITIONS)[number], name: string) {
  return (
    plan.status === "active" &&
    plan.name === name &&
    String(plan.currency).toUpperCase() === expected.currency &&
    String(plan.interval).toLowerCase() === "monthly" &&
    Number(plan.amount) === expected.amount &&
    Number(plan.duration || 0) === 0
  );
}

async function findExistingPlan(expected: (typeof PLAN_DEFINITIONS)[number], name: string) {
  for (let page = 1; page <= 10; page += 1) {
    const response = await flutterwaveRequest<FlutterwavePlansResponse>(
      `/payment-plans?currency=${expected.currency}&interval=monthly&status=active&page=${page}`,
    );
    const match = (response.data || []).find((plan) => isMatchingPlan(plan, expected, name));
    if (match) return match;
    const totalPages = Number(response.meta?.page_info?.total_pages || 1);
    if (page >= totalPages) break;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const adminSession = await getAdminSession();
  if (!adminSession) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  // Require an explicit confirmation phrase to prevent accidental creation from generic admin requests.
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.confirm !== "CREATE_FLUXKNIGHT_MONTHLY_PLANS") {
    return NextResponse.json({ error: "Explicit provisioning confirmation is required." }, { status: 400 });
  }

  try {
    const rows = await supabaseRest<BillingPlanRow[]>(
      "billing_plans?select=id,slug,name,recurring_fee,metadata&slug=in.(whatsapp-ai-starter,ai-call-receptionist,ai-front-desk-suite)&status=eq.active",
    );
    const planBySlug = new Map(rows.map((row) => [row.slug, row]));
    const results: Array<{ slug: string; currency: string; planId: number; reused: boolean }> = [];

    for (const definition of PLAN_DEFINITIONS) {
      const row = planBySlug.get(definition.slug);
      if (!row) throw new Error(`Active billing plan not found: ${definition.slug}`);

      const metadata = { ...(row.metadata || {}) };
      const planIds = { ...((metadata.flutterwave_payment_plans as Record<string, unknown> | undefined) || {}) };
      const existingId = Number(planIds[definition.key] || 0);
      const expectedName = `Fluxknight ${definition.label} Monthly (${definition.currency})`;
      let providerPlan: FlutterwavePlan | null = null;
      let reused = false;

      if (existingId) {
        const verified = await flutterwaveRequest<{ status: string; data?: FlutterwavePlan }>(
          `/payment-plans/${existingId}`,
        );
        if (verified.data && isMatchingPlan(verified.data, definition, expectedName)) {
          providerPlan = verified.data;
          reused = true;
        } else {
          throw new Error(`Stored Flutterwave plan ID failed verification for ${definition.slug} / ${definition.currency}. No replacement was created.`);
        }
      } else {
        providerPlan = await findExistingPlan(definition, expectedName);
        if (providerPlan) {
          reused = true;
        } else {
          const created = await flutterwaveRequest<FlutterwaveCreateResponse>("/payment-plans", {
            method: "POST",
            body: JSON.stringify({
              name: expectedName,
              amount: definition.amount,
              currency: definition.currency,
              interval: "monthly",
            }),
          });
          if (!created.data?.id || !isMatchingPlan(created.data, definition, expectedName)) {
            throw new Error(`Flutterwave did not return a verifiable monthly plan for ${definition.slug} / ${definition.currency}.`);
          }
          providerPlan = created.data;
        }
      }

      if (!providerPlan?.id) throw new Error(`Missing Flutterwave plan ID for ${definition.slug} / ${definition.currency}.`);

      if (Number(planIds[definition.key] || 0) !== providerPlan.id) {
        planIds[definition.key] = providerPlan.id;
        metadata.flutterwave_payment_plans = planIds;
        await supabaseRest(`billing_plans?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ metadata }),
        });
        row.metadata = metadata;
      }

      results.push({
        slug: definition.slug,
        currency: definition.currency,
        planId: providerPlan.id,
        reused,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Monthly Flutterwave plans are provisioned and linked to the billing catalog.",
      plans: results,
      provisionedBy: adminSession.email,
    });
  } catch (error) {
    console.error("[admin/flutterwave-plan-provisioning]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to provision monthly payment plans." },
      { status: 500 },
    );
  }
}
