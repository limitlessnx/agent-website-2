import Link from "next/link";
import { Bot, Building2, Cable, ContactRound, CreditCard, MessageSquareText } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import styles from "@/app/dashboard/DashboardExecutive.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, organizationId, organization } = await requireTenant();

  const [customers, leads, agents, integrations, subscription] = await Promise.all([
    supabase.from("crm_customers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("agents").select("id,status").eq("organization_id", organizationId),
    supabase.from("organization_integrations").select("id,status,provider").eq("organization_id", organizationId),
    supabase.from("organization_subscriptions").select("status,current_period_end,billing_plans(name)").eq("organization_id", organizationId).maybeSingle(),
  ]);

  const cards = [
    { title: "Customers", value: customers.count ?? 0, icon: ContactRound, href: "/dashboard/crm" },
    { title: "Leads", value: leads.count ?? 0, icon: MessageSquareText, href: "/dashboard/crm" },
    { title: "Agents", value: agents.data?.length ?? 0, icon: Bot, href: "/dashboard/agents" },
    { title: "Integrations", value: integrations.data?.length ?? 0, icon: Cable, href: "/dashboard/integrations" },
  ];

  return (
    <main className={`${styles.page} admin-page`}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Organisation workspace</p>
          <h1>{organization.name}</h1>
          <p className={styles.heroLead}>All data shown here is resolved from your authenticated organisation membership and protected by Supabase Row Level Security.</p>
          <div className={styles.heroActions}>
            <Link href="/dashboard/crm"><ContactRound size={15} /> Open CRM</Link>
            <Link href="/dashboard/agents"><Bot size={15} /> Manage agents</Link>
            <Link href="/dashboard/integrations"><Cable size={15} /> Manage integrations</Link>
          </div>
        </div>
      </section>

      <section className={styles.metrics}>
        {cards.map(({ title, value, icon: Icon, href }) => (
          <Link href={href} key={title} className={styles.metric}>
            <div className={styles.metricTop}><span className={styles.metricIcon}><Icon size={17} /></span><small>{title}</small></div>
            <strong>{value}</strong><p>Tenant-isolated records</p>
          </Link>
        ))}
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Organisation status</h2><p>Core workspace information.</p></div></header>
          <div className={styles.actionGrid}>
            <div className={styles.actionCard}><span><Building2 size={15} /></span><span><strong>{organization.name}</strong><small>{organization.slug}</small></span><em>{organization.status}</em></div>
            <div className={styles.actionCard}><span><CreditCard size={15} /></span><span><strong>{(subscription.data?.billing_plans as unknown as { name?: string } | null)?.name ?? "No active plan"}</strong><small>{subscription.data?.current_period_end ? `Renews ${new Date(subscription.data.current_period_end).toLocaleDateString()}` : "Billing not configured"}</small></span><em>{subscription.data?.status ?? "inactive"}</em></div>
          </div>
        </article>
      </section>
    </main>
  );
}
