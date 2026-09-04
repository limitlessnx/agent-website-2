import { NextResponse } from "next/server";
import { getPublicCatalog } from "@/lib/payments/catalog";
import { getRequestBillingRegion } from "@/lib/payments/region";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { region, currency } = await getRequestBillingRegion();
    const plans = await getPublicCatalog(region);

    return NextResponse.json(
      {
        region,
        currency,
        plans: plans.map((plan) => ({
          slug: plan.slug,
          name: plan.name,
          currency: plan.currency,
          installationFee: plan.installationFee,
          recurringFee: plan.recurringFee,
          billingInterval: plan.billingInterval,
          custom: plan.custom,
        })),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[Public Pricing API Error]", error);
    return NextResponse.json({ error: "Pricing is temporarily unavailable" }, { status: 503 });
  }
}
