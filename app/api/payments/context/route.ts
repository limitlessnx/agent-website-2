import { NextResponse } from "next/server";
import { getRequestBillingRegion } from "@/lib/payments/region";
import { getPublicCatalog } from "@/lib/payments/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { region, currency } = await getRequestBillingRegion();
    const plans = await getPublicCatalog(region);

    return NextResponse.json({
      region,
      currency,
      currencyLocked: true,
      plans: plans.map((plan) => ({
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        currency: plan.currency,
        installationFee: plan.custom ? null : plan.installationFee,
        recurringFee: plan.custom ? null : plan.recurringFee,
        billingInterval: plan.billingInterval,
        custom: plan.custom,
      })),
    });
  } catch (error) {
    console.error("[payments/context]", error);
    return NextResponse.json({ error: "Unable to load payment context." }, { status: 500 });
  }
}
