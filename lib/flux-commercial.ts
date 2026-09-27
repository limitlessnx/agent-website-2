import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type FluxCommercialSnapshot={
  organizationId:string;
  subscription:null|{
    id:string;status:string;provider:string|null;
    currentPeriodStart:string|null;currentPeriodEnd:string|null;gracePeriodEnd:string|null;trialEndsAt:string|null;
    planId:string;planName:string;planSlug:string;currency:string;recurringFee:number;billingInterval:string;planCode:string|null;
  };
  wallet:null|{
    planCode:string;monthlyAllowance:number;balance:number;bonusBalance:number;topUpBalance:number;
    trialCreditLimit:number|null;trialEndsAt:string|null;currentPeriodStart:string;currentPeriodEnd:string|null;status:string;
  };
  servicePackage:null|{
    assignmentId:string;status:string;packageId:string;packageName:string;packageSlug:string;
    startsAt:string;endsAt:string|null;
  };
  usage:{usedThisMonth:number;usageEvents:number;providerCostCents:number};
  systems:{active:number;needsAttention:number};
};

export function getFluxCommercialSnapshot(organizationId:string){
  return supabaseServerRequest<FluxCommercialSnapshot>("rpc/get_flux_commercial_snapshot",{
    method:"POST",
    body:JSON.stringify({target_organization_id:organizationId}),
  });
}

export function syncDueFluxSubscriptionWallets(){
  return supabaseServerRequest<{scanned:number;synced:number;failed:number;checkedAt:string}>("rpc/sync_due_flux_subscription_wallets",{
    method:"POST",
    body:"{}",
  });
}
