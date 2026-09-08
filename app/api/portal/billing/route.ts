import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getFluxWalletSummary } from "@/lib/flux-credits";

export async function GET() {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const wallet = await getFluxWalletSummary(session.organizationId);
    return NextResponse.json({
      wallet: {
        planName: wallet.planName,
        monthlyCredits: wallet.monthlyCredits,
        balance: wallet.balance,
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
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load billing summary." }, { status: 500 });
  }
}
