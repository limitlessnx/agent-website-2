import Link from "next/link";
import { getPlatformAnalyticsHealth } from "@/lib/analytics-phase-e";

export const dynamic="force-dynamic";
export const metadata={title:"Platform Analytics | Fluxknight"};

function number(value:number|null|undefined){
  return new Intl.NumberFormat("en-NG").format(value||0);
}
function rate(value:number|null){
  return value==null?"—":value.toFixed(1)+"%";
}

export default async function PlatformAnalyticsPage({
  searchParams,
}:{
  searchParams:Promise<{period?:string}>;
}){
  const params=await searchParams;
  const requested=Number(params.period||7);
  const periodDays=[1,7,30].includes(requested)?requested:7;
  const health=await getPlatformAnalyticsHealth(periodDays);

  return <main className="admin-page">
    <div className="admin-page-header">
      <div>
        <p className="admin-kicker">Super Admin</p>
        <h1>Platform analytics & tenant health</h1>
        <p>Cross-tenant operational health from canonical runtime, orchestration, handoff and WhatsApp records.</p>
      </div>
      <div className="admin-action-list">
        {[1,7,30].map((days)=><Link key={days} href={"/dashboard/analytics?period="+days}>{days}d</Link>)}
      </div>
    </div>

    <div className="admin-metric-grid">
      <article className="admin-metric-card"><p>Active organizations</p><strong>{number(health.organizations)}</strong><span>Included in health scan</span></article>
      <article className="admin-metric-card"><p>Critical</p><strong>{number(health.critical)}</strong><span>Immediate operator review</span></article>
      <article className="admin-metric-card"><p>Attention</p><strong>{number(health.attention)}</strong><span>Non-critical issues present</span></article>
      <article className="admin-metric-card"><p>Healthy</p><strong>{number(health.organizations-health.critical-health.attention)}</strong><span>No tracked failures in period</span></article>
    </div>

    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Tenant health</h2><p>Health labels are deterministic operational thresholds, not customer-success scores.</p></div></div>
      <div className="admin-list">
        {health.tenants.map((tenant)=><Link
          key={tenant.organizationId}
          href={"/dashboard/clients?organizationId="+encodeURIComponent(tenant.organizationId)}
          className="admin-list-row"
        >
          <div>
            <strong>{tenant.name}</strong>
            <span>
              {number(tenant.activeSystems)} active systems · {number(tenant.runtimeFailures)} runtime failures · {number(tenant.eventFailures)} event failures · {number(tenant.slaBreaches)} SLA breaches
            </span>
            <small>Runtime {rate(tenant.runtimeFailureRate)} failed · WhatsApp {rate(tenant.whatsappFailureRate)} failed</small>
          </div>
          <em>{tenant.health}</em>
        </Link>)}
        {!health.tenants.length?<p className="admin-empty">No active tenant organizations found.</p>:null}
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Health methodology</h2><p>Critical status requires concrete operational evidence.</p></div></div>
      <p className="admin-empty">
        Critical includes systems needing attention, 3+ event failures, 3+ SLA breaches, or failure rates of at least 25% when there are at least five runtime or WhatsApp attempts. Any smaller tracked failure produces Attention; otherwise the tenant is Healthy.
      </p>
    </section>
  </main>;
}
