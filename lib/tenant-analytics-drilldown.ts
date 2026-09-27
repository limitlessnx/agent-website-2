import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type AnalyticsDailyPoint={
  date:string;
  conversations:number;
  messages:number;
  handoffs:number;
  appointments:number;
  runtimeExecutions:number;
  runtimeFailed:number;
  avgLatencyMs:number|null;
  whatsappAttempts:number;
  whatsappFailed:number;
};

export type AnalyticsSystemRow={
  organizationSystemId:string;
  systemCatalogId:string;
  slug:string;
  name:string;
  status:string;
  events:number;
  eventFailures:number;
  handoffs:number;
  appointments:number;
  confirmedAppointments:number;
};

export type AnalyticsAgentRow={
  agentId:string;
  slug:string;
  name:string;
  status:string;
  model?:string|null;
  conversations:number;
  messages:number;
  runtimeExecutions:number;
  runtimeFailed:number;
  runtimeSuccessRate:number|null;
  avgLatencyMs:number|null;
  handoffs:number;
  aiHandledRate:number|null;
};

export type AnalyticsHandoffCategory={
  category:string;
  count:number;
  resolved:number;
  slaTracked:number;
  slaBreached:number;
  slaMetRate:number|null;
  avgClaimMinutes:number|null;
  avgResolutionMinutes:number|null;
};

export type AnalyticsAssigneeRow={
  membershipId:string;
  assigned:number;
  claimed:number;
  resolved:number;
  open:number;
  slaTracked:number;
  slaBreached:number;
  slaMetRate:number|null;
  avgClaimMinutes:number|null;
  avgResolutionMinutes:number|null;
};

export type AnalyticsStageTransition={
  fromStageId?:string|null;
  fromStage:string;
  toStageId:string;
  toStage:string;
  count:number;
};

export type TenantAnalyticsDrilldown={
  organizationId:string;
  generatedAt:string;
  periodDays:number;
  periodStart:string;
  daily:AnalyticsDailyPoint[];
  systems:AnalyticsSystemRow[];
  agents:AnalyticsAgentRow[];
  handoffCategories:AnalyticsHandoffCategory[];
  assignees:AnalyticsAssigneeRow[];
  stageTransitions:AnalyticsStageTransition[];
};

export async function getTenantAnalyticsDrilldown(
  organizationId:string,
  periodDays=30,
):Promise<TenantAnalyticsDrilldown>{
  const days=Math.max(1,Math.min(365,Math.trunc(periodDays)||30));
  return supabaseServerRequest<TenantAnalyticsDrilldown>("rpc/get_tenant_analytics_drilldown",{
    method:"POST",
    body:JSON.stringify({
      p_organization_id:organizationId,
      p_period_days:days,
    }),
  });
}
