import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { analyticsChangePercent, getTenantOperationalAnalytics } from "@/lib/tenant-operational-analytics";
import { getTenantAnalyticsDrilldown } from "@/lib/tenant-analytics-drilldown";
import { listOrganizationMembers } from "@/lib/organization-membership";
import AnalyticsTrendChart from "./AnalyticsTrendChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics | Fluxknight" };

function trendLabel(current:number,previous:number){
  const change=analyticsChangePercent(current,previous);
  if(change===null) return previous===0&&current>0?"new":"no baseline";
  if(change===0) return "0% vs previous";
  return (change>0?"+":"")+change+"% vs previous";
}

function rate(value:number|null){
  return value==null?"—":value.toFixed(1)+"%";
}

function duration(value:number|null){
  if(value==null) return "—";
  if(value<60) return value.toFixed(1)+" min";
  const hours=value/60;
  return hours<24?hours.toFixed(1)+" hr":(hours/24).toFixed(1)+" d";
}

function number(value:number|null|undefined){
  return new Intl.NumberFormat("en-NG").format(value||0);
}

export default async function AnalyticsPage({
  searchParams,
}:{
  searchParams:Promise<{period?:string}>;
}) {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["analytics.view"]); } catch { redirect("/portal"); }

  const params=await searchParams;
  const requested=Number(params.period||30);
  const periodDays=[7,30,90].includes(requested)?requested:30;
  const [analytics,drilldown,members]=await Promise.all([
    getTenantOperationalAnalytics(session.organizationId,periodDays),
    getTenantAnalyticsDrilldown(session.organizationId,periodDays),
    listOrganizationMembers(session.organizationId,session.userId).catch(()=>[]),
  ]);
  const memberById=new Map(members.map((member)=>[member.id,member]));

  const stageMax=Math.max(1,...analytics.stageDistribution.map((item)=>item.count));
  const channelMax=Math.max(1,...analytics.channelDistribution.map((item)=>item.count));

  return <main className="portal-page">
    <section className="portal-command-hero">
      <div>
        <p className="portal-kicker">Analytics</p>
        <h1>Operational performance</h1>
        <p>Canonical tenant metrics across customers, conversations, AI runtime, human handoffs, appointments and connected channels.</p>
      </div>
      <div className="portal-action-list">
        {[7,30,90].map((days)=>
          <Link key={days} href={"/portal/analytics?period="+days} aria-current={periodDays===days?"page":undefined}>
            {days} days
          </Link>
        )}
      </div>
    </section>

    <section className="portal-business-metrics">
      <article className="portal-business-metric">
        <span>Customers</span>
        <strong>{number(analytics.customers.total)}</strong>
        <small>{number(analytics.customers.currentNew)} new · {trendLabel(analytics.customers.currentNew,analytics.customers.previousNew)}</small>
      </article>
      <article className="portal-business-metric">
        <span>Conversations</span>
        <strong>{number(analytics.conversations.current)}</strong>
        <small>{trendLabel(analytics.conversations.current,analytics.conversations.previous)} · {rate(analytics.conversations.aiHandledRate)} AI-handled</small>
      </article>
      <article className="portal-business-metric">
        <span>Human handoffs</span>
        <strong>{number(analytics.handoffs.current)}</strong>
        <small>{rate(analytics.handoffs.slaMetRate)} SLA met · {number(analytics.handoffs.resolved)} resolved</small>
      </article>
      <article className="portal-business-metric">
        <span>Appointments</span>
        <strong>{number(analytics.appointments.current)}</strong>
        <small>{rate(analytics.appointments.confirmationRate)} confirmed/rescheduled</small>
      </article>
      <article className="portal-business-metric">
        <span>AI runtime</span>
        <strong>{rate(analytics.runtime.successRate)}</strong>
        <small>{number(analytics.runtime.current)} executions · {number(analytics.runtime.failed)} failed</small>
      </article>
      <article className="portal-business-metric">
        <span>WhatsApp delivery</span>
        <strong>{rate(analytics.whatsapp.deliverySuccessRate)}</strong>
        <small>{number(analytics.whatsapp.current)} attempts · {number(analytics.whatsapp.failed)} failed</small>
      </article>
      <article className="portal-business-metric">
        <span>Active systems</span>
        <strong>{number(analytics.systems.active)}</strong>
        <small>{number(analytics.systems.needsAttention)} need attention</small>
      </article>
      <article className="portal-business-metric">
        <span>Messages</span>
        <strong>{number(analytics.messages.current)}</strong>
        <small>{number(analytics.messages.ai)} AI · {number(analytics.messages.human)} human · {number(analytics.messages.customer)} customer</small>
      </article>
    </section>

    <section className="portal-grid">
      <AnalyticsTrendChart
        data={drilldown.daily}
        series={[
          {key:"conversations",label:"Conversations"},
          {key:"messages",label:"Messages"},
          {key:"handoffs",label:"Handoffs"},
          {key:"appointments",label:"Appointments"},
        ]}
        title="Customer activity over time"
        description="Daily canonical customer activity during the selected period."
      />
      <AnalyticsTrendChart
        data={drilldown.daily}
        series={[
          {key:"runtimeExecutions",label:"AI executions"},
          {key:"runtimeFailed",label:"Runtime failures"},
          {key:"whatsappAttempts",label:"WhatsApp attempts"},
          {key:"whatsappFailed",label:"WhatsApp failures"},
        ]}
        title="Automation health over time"
        description="Daily runtime and WhatsApp delivery activity."
      />
    </section>

    <section className="portal-grid">
      <article className="portal-card">
        <div className="portal-card-head"><div>
          <h2>Systems</h2>
          <p>Activity attributed to installed Fluxknight systems.</p>
        </div></div>
        <div className="portal-list">
          {drilldown.systems.map((item)=><Link
            href={"/portal/analytics/systems/"+item.organizationSystemId+"?period="+periodDays}
            className="portal-list-row"
            key={item.organizationSystemId}
          >
            <div><strong>{item.name}</strong><span>{item.status} · {number(item.events)} events · {number(item.handoffs)} handoffs</span></div>
            <em>{number(item.appointments)} appts</em>
          </Link>)}
          {!drilldown.systems.length?<p className="portal-empty">No canonical installed systems are attached to this tenant yet.</p>:null}
        </div>
      </article>

      <article className="portal-card">
        <div className="portal-card-head"><div>
          <h2>Agents</h2>
          <p>AI runtime and customer handling by canonical agent.</p>
        </div></div>
        <div className="portal-list">
          {drilldown.agents.map((item)=><Link
            href={"/portal/analytics/agents/"+item.agentId+"?period="+periodDays}
            className="portal-list-row"
            key={item.agentId}
          >
            <div><strong>{item.name}</strong><span>{item.model||"Model not recorded"} · {number(item.conversations)} conversations · {number(item.handoffs)} handoffs</span></div>
            <em>{rate(item.runtimeSuccessRate)} runtime</em>
          </Link>)}
          {!drilldown.agents.length?<p className="portal-empty">No canonical agents are configured for this tenant.</p>:null}
        </div>
      </article>
    </section>

    <section className="portal-grid">
      <article className="portal-card">
        <div className="portal-card-head"><div>
          <h2>Human handoff performance</h2>
          <p>How quickly the team takes ownership and closes escalated customer conversations.</p>
        </div></div>
        <div className="portal-list">
          <div className="portal-list-row"><div><strong>Average claim time</strong><span>Handoff created → human claim</span></div><em>{duration(analytics.handoffs.avgClaimMinutes)}</em></div>
          <div className="portal-list-row"><div><strong>Average resolution time</strong><span>Handoff created → resolved/closed</span></div><em>{duration(analytics.handoffs.avgResolutionMinutes)}</em></div>
          <div className="portal-list-row"><div><strong>SLA performance</strong><span>{number(analytics.handoffs.slaBreached)} breached · {number(analytics.handoffs.slaTracked)} tracked</span></div><em>{rate(analytics.handoffs.slaMetRate)}</em></div>
          <div className="portal-list-row"><div><strong>Post-handoff follow-up</strong><span>Completed customer check-ins</span></div><em>{number(analytics.handoffs.followUpCompleted)} / {number(analytics.handoffs.followUpRequired)}</em></div>
        </div>
      </article>

      <article className="portal-card">
        <div className="portal-card-head"><div>
          <h2>AI execution health</h2>
          <p>Runtime reliability, tool execution and latency for this organization.</p>
        </div></div>
        <div className="portal-list">
          <div className="portal-list-row"><div><strong>Execution success</strong><span>Completed AI runtime jobs</span></div><em>{rate(analytics.runtime.successRate)}</em></div>
          <div className="portal-list-row"><div><strong>Average latency</strong><span>Measured runtime execution latency</span></div><em>{analytics.runtime.avgLatencyMs==null?"—":number(analytics.runtime.avgLatencyMs)+" ms"}</em></div>
          <div className="portal-list-row"><div><strong>Tool calls</strong><span>{number(analytics.runtime.toolSucceeded)} succeeded · {number(analytics.runtime.toolFailed)} failed</span></div><em>{number(analytics.runtime.toolCalls)}</em></div>
          <div className="portal-list-row"><div><strong>Recorded model cost</strong><span>Stored runtime cost_minor units</span></div><em>{number(analytics.runtime.costMinor)}</em></div>
        </div>
      </article>
    </section>

    <section className="portal-grid">
      <article className="portal-card">
        <div className="portal-card-head"><div>
          <h2>Customer stages</h2>
          <p>Current distribution across this organization's configured customer journey.</p>
        </div></div>
        <div className="portal-list">
          {analytics.stageDistribution.map((item)=><div className="portal-list-row" key={item.stageId}>
            <div style={{flex:1}}>
              <strong>{item.name}</strong>
              <span>{item.category.replaceAll("_"," ")}</span>
              <div style={{height:6,borderRadius:999,background:"rgba(255,255,255,.07)",marginTop:8,overflow:"hidden"}}>
                <div style={{height:"100%",width:Math.max(item.count?6:0,(item.count/stageMax)*100)+"%",background:"currentColor",opacity:.7}} />
              </div>
            </div>
            <em>{number(item.count)}</em>
          </div>)}
          {!analytics.stageDistribution.length?<p className="portal-empty">No customer stages configured.</p>:null}
        </div>
      </article>

      <article className="portal-card">
        <div className="portal-card-head"><div>
          <h2>Conversation channels</h2>
          <p>Where customer conversations started during the selected period.</p>
        </div></div>
        <div className="portal-list">
          {analytics.channelDistribution.map((item)=><div className="portal-list-row" key={item.channel}>
            <div style={{flex:1}}>
              <strong>{item.channel.replaceAll("_"," ")}</strong>
              <div style={{height:6,borderRadius:999,background:"rgba(255,255,255,.07)",marginTop:8,overflow:"hidden"}}>
                <div style={{height:"100%",width:Math.max(item.count?6:0,(item.count/channelMax)*100)+"%",background:"currentColor",opacity:.7}} />
              </div>
            </div>
            <em>{number(item.count)}</em>
          </div>)}
          {!analytics.channelDistribution.length?<p className="portal-empty">No canonical conversations recorded in this period.</p>:null}
        </div>
      </article>
    </section>

    <section className="portal-card">
      <div className="portal-card-head"><div>
        <h2>Appointment & WhatsApp outcomes</h2>
        <p>Deterministic operational outcomes rather than model-generated estimates.</p>
      </div></div>
      <div className="portal-list">
        <div className="portal-list-row"><div><strong>Appointments confirmed/rescheduled</strong><span>Successful calendar outcomes</span></div><em>{number(analytics.appointments.confirmed)}</em></div>
        <div className="portal-list-row"><div><strong>Appointments cancelled</strong><span>Customer/team cancellations</span></div><em>{number(analytics.appointments.cancelled)}</em></div>
        <div className="portal-list-row"><div><strong>WhatsApp successful delivery states</strong><span>Sent, delivered, read or accepted</span></div><em>{number(analytics.whatsapp.successful)}</em></div>
        <div className="portal-list-row"><div><strong>WhatsApp reads</strong><span>Provider-confirmed read state</span></div><em>{number(analytics.whatsapp.read)}</em></div>
      </div>
    </section>

    <section className="portal-grid">
      <article className="portal-card">
        <div className="portal-card-head"><div>
          <h2>Handoff reasons</h2>
          <p>Why customer conversations required a human during this period.</p>
        </div></div>
        <div className="portal-list">
          {drilldown.handoffCategories.map((item)=><div className="portal-list-row" key={item.category}>
            <div><strong>{item.category.replaceAll("_"," ")}</strong><span>{number(item.resolved)} resolved · {number(item.slaBreached)} SLA breaches</span></div>
            <em>{number(item.count)}</em>
          </div>)}
          {!drilldown.handoffCategories.length?<p className="portal-empty">No human handoffs recorded in this period.</p>:null}
        </div>
      </article>

      <article className="portal-card">
        <div className="portal-card-head"><div>
          <h2>Human workload</h2>
          <p>Assignment and SLA performance for team members receiving handoffs.</p>
        </div></div>
        <div className="portal-list">
          {drilldown.assignees.map((item)=>{
            const member=memberById.get(item.membershipId);
            return <div className="portal-list-row" key={item.membershipId}>
              <div><strong>{member?.email||item.membershipId.slice(0,8)}</strong><span>{number(item.resolved)} resolved · {number(item.open)} open · {rate(item.slaMetRate)} SLA</span></div>
              <em>{duration(item.avgClaimMinutes)}</em>
            </div>;
          })}
          {!drilldown.assignees.length?<p className="portal-empty">No assigned handoffs recorded in this period.</p>:null}
        </div>
      </article>
    </section>

    <section className="portal-card">
      <div className="portal-card-head"><div>
        <h2>Customer stage movement</h2>
        <p>Observed transitions through this organization's configured customer journey.</p>
      </div></div>
      <div className="portal-list">
        {drilldown.stageTransitions.map((item)=><div className="portal-list-row" key={(item.fromStageId||"none")+"-"+item.toStageId}>
          <div><strong>{item.fromStage} → {item.toStage}</strong><span>Recorded stage transitions</span></div>
          <em>{number(item.count)}</em>
        </div>)}
        {!drilldown.stageTransitions.length?<p className="portal-empty">No customer stage transitions recorded in this period.</p>:null}
      </div>
    </section>

    <section className="portal-card">
      <div className="portal-card-head"><div>
        <h2>How these numbers are calculated</h2>
        <p>Current period: last {periodDays} days. Trend comparisons use the immediately preceding {periodDays}-day period.</p>
      </div></div>
      <p className="portal-empty">
        Metrics come from canonical Fluxknight records. “AI-handled” means a conversation did not create a human handoff in the selected period; it is a containment indicator, not a customer-satisfaction score. Missing canonical records are shown as zero or unavailable rather than inferred from legacy workflows.
      </p>
    </section>
  </main>;
}
