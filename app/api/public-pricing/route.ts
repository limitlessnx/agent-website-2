import { NextResponse } from "next/server";
import { getPublicCatalog } from "@/lib/payments/catalog";
import { currencyForRegion, getRequestBillingRegion, type BillingRegion } from "@/lib/payments/region";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const detected = await getRequestBillingRegion();
    const url = new URL(request.url);
    const requestedView = url.searchParams.get("view")?.toLowerCase();

    let region: BillingRegion = detected.region;
    if (detected.region === "NG" && requestedView === "international") {
      region = "INTERNATIONAL";
    }

    const currency = currencyForRegion(region);
    const plans = await getPublicCatalog(region);

    return NextResponse.json(
      {
        detectedRegion: detected.region,
        region,
        currency,
        canViewInternational: detected.region === "NG",
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
