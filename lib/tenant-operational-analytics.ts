import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type AnalyticsTrendMetric={
  current:number;
  previous:number;
};

export type TenantOperationalAnalytics={
  organizationId:string;
  generatedAt:string;
  periodDays:number;
  periodStart:string;
  previousPeriodStart:string;
  customers:{total:number;currentNew:number;previousNew:number};
  conversations:{current:number;previous:number;uniqueCustomers:number;aiHandledRate:number|null};
  messages:{current:number;previous:number;ai:number;human:number;customer:number};
  handoffs:{
    current:number;previous:number;resolved:number;assigned:number;slaBreached:number;slaMetRate:number|null;
    avgClaimMinutes:number|null;avgResolutionMinutes:number|null;followUpRequired:number;followUpCompleted:number;
  };
  appointments:{
    current:number;previous:number;confirmed:number;cancelled:number;failed:number;confirmationRate:number|null;
  };
  runtime:{
    current:number;previous:number;succeeded:number;failed:number;successRate:number|null;avgLatencyMs:number|null;
    costMinor:number;toolCalls:number;toolSucceeded:number;toolFailed:number;
  };
  whatsapp:{
    current:number;previous:number;successful:number;failed:number;read:number;deliverySuccessRate:number|null;
  };
  systems:{active:number;needsAttention:number};
  stageDistribution:Array<{stageId:string;key:string;name:string;category:string;count:number}>;
  channelDistribution:Array<{channel:string;count:number}>;
  stageTransitions:Array<{stageId:string;name:string;count:number}>;
};

export async function getTenantOperationalAnalytics(
  organizationId:string,
  periodDays=30,
):Promise<TenantOperationalAnalytics>{
  const days=Math.max(1,Math.min(365,Math.trunc(periodDays)||30));
  return supabaseServerRequest<TenantOperationalAnalytics>("rpc/get_tenant_operational_analytics",{
    method:"POST",
    body:JSON.stringify({
      p_organization_id:organizationId,
      p_period_days:days,
    }),
  });
}

export function analyticsChangePercent(current:number,previous:number){
  if(previous===0) return current===0?0:null;
  return Math.round(((current-previous)/previous)*1000)/10;
}
