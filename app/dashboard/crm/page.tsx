import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  MessageSquareText,
  Search,
  Target,
  Users,
} from "@/components/admin/ServerIcons";
import { requireTenant } from "@/lib/tenant";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

function state(value: unknown) {
  return clean(value).toLowerCase();
}

function formatDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric", year: "numeric" }).format(date)
    : "Date unavailable";
}

function stageTone(value: unknown) {
  const current = state(value);
  if (["lost", "cold", "inactive"].some((item) => current.includes(item))) return styles.muted;
  if (["converted", "won", "customer", "closed", "active"].some((item) => current.includes(item))) return styles.good;
  if (["qualified", "hot", "inspection", "proposal"].some((item) => current.includes(item))) return styles.priority;
  return styles.neutral;
}

function detailsText(details: unknown, key: string) {
  if (!details || typeof details !== "object") return "";
  return clean((details as Record<string, unknown>)[key]);
}

export default async function CrmPage() {
  const { supabase, organizationId, organization } = await requireTenant();
  const [{ data: customers }, { data: leads }] = await Promise.all([
    supabase
      .from("crm_customers")
      .select("id,full_name,email,phone,status,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("crm_leads")
      .select("id,stage,score,source,summary,details,created_at,customer_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const customerRows = customers || [];
  const leadRows = leads || [];
  const customersById = new Map(customerRows.map((customer) => [String(customer.id), customer]));

  const activeLeads = leadRows.filter((lead) => !["closed", "lost", "converted", "won", "customer"].some((item) => state(lead.stage).includes(item)));
  const qualified = leadRows.filter((lead) => {
    const lifecycle = state(lead.stage);
    return !["lost", "cold"].some((item) => lifecycle.includes(item)) &&
      (["qualified", "hot", "inspection", "proposal"].some((item) => lifecycle.includes(item)) || Number(lead.score || 0) >= 70);
  });
  const converted = leadRows.filter((lead) => ["converted", "won", "customer"].some((item) => state(lead.stage).includes(item)));
  const conversionRate = leadRows.length ? Math.round((converted.length / leadRows.length) * 100) : 0;
  const limitless = organization.slug === "limitless-realty";

  return (
    <main className="admin-page">
      <header className={styles.hero}>
        <div>
          <span className={styles.kicker}>{organization.name} · CRM</span>
          <h1>Customers & Leads</h1>
          <p>Follow customer movement from first contact to conversion using only records belonging to {organization.name}.</p>
        </div>
        <div className={styles.heroActions}>
          <span className={styles.scope}><i /> Organization scoped</span>
          {limitless ? <Link href="/dashboard/limitless/leads">Open Lead CRM <ArrowUpRight size={14} /></Link> : null}
        </div>
      </header>

      <section className={styles.metrics} aria-label="CRM summary">
        <article><span className={styles.metricIcon}><Users size={17} /></span><strong>{customerRows.length}</strong><p>Customers</p><small>Visible in {organization.name}</small></article>
        <article><span className={styles.metricIcon}><Target size={17} /></span><strong>{activeLeads.length}</strong><p>Active leads</p><small>Still moving through pipeline</small></article>
        <article><span className={styles.metricIcon}><MessageSquareText size={17} /></span><strong>{qualified.length}</strong><p>Qualified</p><small>Higher-intent lead states</small></article>
        <article><span className={styles.metricIcon}><Building2 size={17} /></span><strong>{conversionRate}%</strong><p>Conversion</p><small>{converted.length} converted lead{converted.length === 1 ? "" : "s"}</small></article>
      </section>

      <section className={styles.commandBar}>
        <div><Search size={16} /><span>Recent CRM activity</span></div>
        <div className={styles.commandLinks}><Link href="/dashboard/conversations">Conversations</Link><Link href="/dashboard/activity">Activity</Link></div>
      </section>

      <section className={styles.crmGrid}>
        <article className={styles.panel}>
          <header><div><span className={styles.kicker}>PIPELINE</span><h2>Lead movement</h2><p>Latest organization-scoped lead records.</p></div><b>{leadRows.length}</b></header>
          <div className={styles.list}>
            {leadRows.map((lead) => {
              const customer = customersById.get(String(lead.customer_id));
              const title = clean(customer?.full_name || customer?.email || customer?.phone || lead.summary || detailsText(lead.details, "name")) || "Untitled lead";
              const current = lead.stage || "new";
              return (
                <div key={lead.id} className={styles.row}>
                  <div className={styles.rowAvatar}>{title.charAt(0).toUpperCase() || "L"}</div>
                  <div className={styles.rowMain}><strong>{title}</strong><span>{lead.source || "Unknown source"} · {formatDate(lead.created_at)}</span></div>
                  <span className={[styles.status, stageTone(current)].join(" ")}>{clean(current).replaceAll("_", " ") || "new"}</span>
                </div>
              );
            })}
            {!leadRows.length ? <div className={styles.empty}><Target size={18} /><div><strong>No leads yet</strong><span>New {organization.name} CRM leads will appear here.</span></div></div> : null}
          </div>
        </article>

        <article className={styles.panel}>
          <header><div><span className={styles.kicker}>CUSTOMERS</span><h2>Customer directory</h2><p>Identity and contact details for this organization.</p></div><b>{customerRows.length}</b></header>
          <div className={styles.list}>
            {customerRows.map((customer) => {
              const title = customer.full_name || customer.email || customer.phone || "Unnamed customer";
              return (
                <div key={customer.id} className={styles.row}>
                  <div className={styles.rowAvatar}>{clean(title).charAt(0).toUpperCase() || "C"}</div>
                  <div className={styles.rowMain}><strong>{title}</strong><span>{[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details saved"}</span></div>
                  <span className={[styles.status, stageTone(customer.status || "active")].join(" ")}>{customer.status || "active"}</span>
                </div>
              );
            })}
            {!customerRows.length ? <div className={styles.empty}><Users size={18} /><div><strong>No customers yet</strong><span>Customer records for {organization.name} will appear here.</span></div></div> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
