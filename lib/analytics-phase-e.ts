import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type FunnelStage={
  stageId:string;key:string;name:string;category:string;position:number;terminal:boolean;
  reached:number;previousReached:number|null;stepConversionRate:number|null;
};
export type FunnelBreakdown={source?:string;channel?:string;leads?:number;customers?:number;won:number;wonRate:number|null};
export type TenantFunnelAnalytics={
  organizationId:string;periodDays:number;periodStart:string;
  cohort:{customers:number;won:number;lost:number;followUp:number;wonRate:number|null};
  funnel:FunnelStage[];
  sources:FunnelBreakdown[];
  channels:FunnelBreakdown[];
  handoffComparison:{
    withHandoff:{customers:number;won:number;wonRate:number|null};
    withoutHandoff:{customers:number;won:number;wonRate:number|null};
  };
  appointmentComparison:{
    withAppointment:{customers:number;won:number;wonRate:number|null};
    withoutAppointment:{customers:number;won:number;wonRate:number|null};
  };
};

export type TenantBusinessValueAnalytics={
  organizationId:string;periodDays:number;periodStart:string;configured:boolean;currency:string|null;
  automationVolume:{
    aiHandledConversations:number;completedFollowUps:number;confirmedAppointments:number;assignedHandoffs:number;
  };
  assumptions:null|{
    humanHourlyValue:number|null;
    minutesPerAiHandledConversation:number|null;
    minutesPerFollowUp:number|null;
    minutesPerAppointment:number|null;
    minutesPerHandoffTriage:number|null;
  };
  estimatedMinutesSaved:number|null;
  estimatedHoursSaved:number|null;
  estimatedValue:number|null;
};

export type PlatformTenantHealth={
  organizationId:string;name:string;slug:string;status:string;
  activeSystems:number;systemsNeedingAttention:number;executions:number;runtimeFailures:number;
  runtimeFailureRate:number|null;eventFailures:number;slaBreaches:number;
  whatsappAttempts:number;whatsappFailures:number;whatsappFailureRate:number|null;
  health:"healthy"|"attention"|"critical";
};

export type PlatformAnalyticsHealth={
  periodDays:number;periodStart:string;organizations:number;critical:number;attention:number;tenants:PlatformTenantHealth[];
};

export function getTenantFunnelAnalytics(organizationId:string,periodDays=30){
  return supabaseServerRequest<TenantFunnelAnalytics>("rpc/get_tenant_funnel_analytics",{
    method:"POST",
    body:JSON.stringify({p_organization_id:organizationId,p_period_days:periodDays}),
  });
}

export function getTenantBusinessValueAnalytics(organizationId:string,periodDays=30){
  return supabaseServerRequest<TenantBusinessValueAnalytics>("rpc/get_tenant_business_value_analytics",{
    method:"POST",
    body:JSON.stringify({p_organization_id:organizationId,p_period_days:periodDays}),
  });
}

export function getPlatformAnalyticsHealth(periodDays=7){
  return supabaseServerRequest<PlatformAnalyticsHealth>("rpc/get_platform_analytics_health",{
    method:"POST",
    body:JSON.stringify({p_period_days:periodDays}),
  });
}

export function scanAnalyticsAnomalies(){
  return supabaseServerRequest<{activeOrRefreshed:number;resolved:number;scannedAt:string}>("rpc/scan_analytics_anomalies",{
    method:"POST",
    body:"{}",
  });
}
