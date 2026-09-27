import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { getTenantAnalyticsDrilldown } from "@/lib/tenant-analytics-drilldown";

export const dynamic="force-dynamic";

function number(value:number|null|undefined){
  return new Intl.NumberFormat("en-NG").format(value||0);
}

function rate(numerator:number,denominator:number){
  return denominator<=0?"—":((numerator/denominator)*100).toFixed(1)+"%";
}

export default async function SystemAnalyticsPage({
  params,searchParams,
}:{
  params:Promise<{id:string}>;
  searchParams:Promise<{period?:string}>;
}){
  const session=await getClientSession();
  if(!session) redirect("/account/login");
  try{await requirePortalPermission(session,["analytics.view"]);}catch{redirect("/portal");}
  const [{id},query]=await Promise.all([params,searchParams]);
  const requested=Number(query.period||30);
  const periodDays=[7,30,90].includes(requested)?requested:30;
  const analytics=await getTenantAnalyticsDrilldown(session.organizationId,periodDays);
  const system=analytics.systems.find((item)=>item.organizationSystemId===id);
  if(!system) notFound();

  return <main className="portal-page">
    <section className="portal-command-hero">
      <div><p className="portal-kicker">System analytics</p><h1>{system.name}</h1><p>{system.status} · last {periodDays} days</p></div>
      <Link href={"/portal/analytics?period="+periodDays}>Back to analytics</Link>
    </section>

    <section className="portal-business-metrics">
      <article className="portal-business-metric"><span>Events</span><strong>{number(system.events)}</strong><small>{number(system.eventFailures)} failed</small></article>
      <article className="portal-business-metric"><span>Event success</span><strong>{rate(system.events-system.eventFailures,system.events)}</strong><small>source-system events</small></article>
      <article className="portal-business-metric"><span>Human handoffs</span><strong>{number(system.handoffs)}</strong><small>originated from this system</small></article>
      <article className="portal-business-metric"><span>Appointments</span><strong>{number(system.appointments)}</strong><small>{number(system.confirmedAppointments)} confirmed/rescheduled</small></article>
    </section>

    <section className="portal-card">
      <div className="portal-card-head"><div><h2>Attribution rules</h2><p>Only records carrying this installed system ID are attributed here.</p></div></div>
      <p className="portal-empty">
        Events use domain_events.source_system_id. Handoffs use human_handoffs.source_system_id. Appointments use appointments.source_system_id.
        Agent activity is shown separately unless the runtime records an explicit system relationship.
      </p>
    </section>
  </main>;
}
