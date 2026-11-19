import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getFluxBillingSummary } from "@/lib/flux-credits";
import { getOrganizationAccessContext } from "@/lib/organization-membership";
import { getFluxCommercialSnapshot } from "@/lib/flux-commercial";

export async function GET() {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    if (!session.isAdminPreview) {
      const access = await getOrganizationAccessContext(session.organizationId, session.userId).catch(() => null);
      if (!access || !["billing.view", "billing.manage"].some(permission => access.permissions.has(permission))) {
        return NextResponse.json({ error: "Billing access is not permitted." }, { status: 403 });
      }
    }
    const [wallet,commercial] = await Promise.all([
      getFluxBillingSummary(session.organizationId),
      getFluxCommercialSnapshot(session.organizationId),
    ]);
    return NextResponse.json({
      commercial,
      wallet: {
        planName: wallet.planName,
        monthlyCredits: wallet.monthlyCredits,
        balance: wallet.balance,
        capacity: wallet.capacity,
        used: wallet.used,
        percentUsed: wallet.percentUsed,
        renewalDate: wallet.renewalDate,
        trialEndsAt: wallet.trialEndsAt,
        trialCreditLimit: wallet.trialCreditLimit,
        threshold: wallet.threshold,
        chargeableAiPaused: wallet.chargeableAiPaused,
        canTopUp: wallet.canTopUp,
        canRollover: wallet.canRollover,
        customerMessage: wallet.customerMessage,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load billing summary." }, { status: 500 });
  }
}
