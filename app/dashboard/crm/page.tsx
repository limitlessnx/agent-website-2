import { requireTenant } from "@/lib/tenant";
import styles from "./CustomerOperations.module.css";

export const dynamic = "force-dynamic";

type ConversationMetadata = Record<string, unknown> | null;

function textFromMetadata(metadata: ConversationMetadata, keys: string[]) {
  if (!metadata) return "";
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function humanize(value: string | null | undefined, fallback = "Unknown") {
  const normalized = String(value || "").trim();
  return normalized ? normalized.replace(/_/g, " ") : fallback;
}

export default async function CrmPage() {
  const { supabase, organizationId } = await requireTenant();
  const [{ data: customers }, { data: leads }, conversationResult] = await Promise.all([
    supabase
      .from("crm_customers")
      .select("id,display_name,email,phone,status,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("crm_leads")
      .select("id,title,status,stage,source,created_at,customer_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("support_conversations")
      .select("status,priority,metadata")
      .eq("organization_id", organizationId)
      .limit(50),
  ]);

  const conversations = conversationResult.data || [];
  const activeConversations = conversations.filter((conversation) => !["resolved", "closed"].includes(String(conversation.status || "").toLowerCase()));
  const urgentConversations = activeConversations.filter((conversation) => ["high", "critical"].includes(String(conversation.priority || "").toLowerCase()));
  const openLeads = (leads || []).filter((lead) => !["closed", "lost", "converted"].includes(String(lead.status || "").toLowerCase()));
  const linkedLeadCount = new Map<string, number>();

  for (const lead of leads || []) {
    if (lead.customer_id) linkedLeadCount.set(lead.customer_id, (linkedLeadCount.get(lead.customer_id) || 0) + 1);
  }

  return (
    <main className={`admin-page ${styles.page}`}>
      <section className={`admin-page-header ${styles.hero}`}>
        <div>
          <p className="admin-kicker">Customer operations</p>
          <h1>Customers, leads and conversations</h1>
          <p className="admin-muted">One operating view for who is in the pipeline, who is already a customer and which conversations need attention.</p>
        </div>
        <div className={styles.heroStatus}>
          <strong>{urgentConversations.length}</strong>
          <span>urgent conversations</span>
        </div>
      </section>

      <section className={styles.summary} aria-label="Customer operations summary">
        <div><span>Customers</span><strong>{customers?.length || 0}</strong></div>
        <div><span>Open leads</span><strong>{openLeads.length}</strong></div>
        <div><span>Active conversations</span><strong>{activeConversations.length}</strong></div>
        <div><span>Need attention</span><strong>{urgentConversations.length}</strong></div>
      </section>

      <section className={styles.operatingGrid}>
        <article className={styles.primaryPanel}>
          <header className={styles.panelHeader}>
            <div>
              <p className="admin-kicker">Customer lifecycle</p>
              <h2>Customers</h2>
              <p>Identity first, then lifecycle context and linked pipeline activity.</p>
            </div>
            <span>{customers?.length || 0} total</span>
          </header>

          <div className={styles.customerList}>
            {customers?.length ? customers.map((customer) => (
              <div key={customer.id} className={styles.customerRow}>
                <div className={styles.identity}>
                  <strong>{customer.display_name || customer.email || customer.phone || "Unnamed customer"}</strong>
                  <span>{customer.email || customer.phone || "No contact detail saved"}</span>
                </div>
                <div className={styles.rowMeta}>
                  <span data-status={String(customer.status || "").toLowerCase()}>{humanize(customer.status, "No status")}</span>
                  <small>{linkedLeadCount.get(customer.id) || 0} linked lead{(linkedLeadCount.get(customer.id) || 0) === 1 ? "" : "s"}</small>
                </div>
              </div>
            )) : (
              <div className="admin-empty-state">
                <strong>No customers yet</strong>
                <span>Customers will appear here once a lead becomes an active customer record.</span>
              </div>
            )}
          </div>
        </article>

        <aside className={styles.conversationPanel}>
          <header className={styles.panelHeader}>
            <div>
              <p className="admin-kicker">Conversation attention</p>
              <h2>Needs response</h2>
              <p>Open customer conversations ranked by operational urgency.</p>
            </div>
            <span>{activeConversations.length} open</span>
          </header>

          <div className={styles.conversationList}>
            {activeConversations.length ? activeConversations
              .sort((a, b) => {
                const rank: Record<string, number> = { critical: 3, high: 2, medium: 1, normal: 0, low: 0 };
                return (rank[String(b.priority || "").toLowerCase()] || 0) - (rank[String(a.priority || "").toLowerCase()] || 0);
              })
              .slice(0, 12)
              .map((conversation, index) => {
                const metadata = (conversation.metadata || null) as ConversationMetadata;
                const customer = textFromMetadata(metadata, ["customer_name", "customerName", "name", "contact_name", "contactName"]);
                const subject = textFromMetadata(metadata, ["subject", "topic", "summary", "title"]);
                const channel = textFromMetadata(metadata, ["channel", "source", "provider"]);
                const priority = String(conversation.priority || "normal").toLowerCase();
                return (
                  <div key={`${priority}-${index}`} className={styles.conversationRow}>
                    <div>
                      <strong>{customer || subject || "Customer conversation"}</strong>
                      <span>{subject && customer ? subject : channel ? `${humanize(channel)} conversation` : "Conversation context available in the support record"}</span>
                    </div>
                    <div className={styles.conversationState}>
                      <span data-priority={priority}>{humanize(conversation.priority, "Normal")}</span>
                      <small>{humanize(conversation.status, "Open")}</small>
                    </div>
                  </div>
                );
              }) : (
              <div className="admin-empty-state">
                <strong>No open conversations</strong>
                <span>There is currently nothing in the support conversation queue requiring attention.</span>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className={styles.pipelinePanel}>
        <header className={styles.panelHeader}>
          <div>
            <p className="admin-kicker">Pipeline</p>
            <h2>Active leads</h2>
            <p>Lead stage and source remain visible without turning the CRM into three separate dashboards.</p>
          </div>
          <span>{openLeads.length} open</span>
        </header>

        <div className={styles.leadList}>
          {openLeads.length ? openLeads.slice(0, 30).map((lead) => (
            <div key={lead.id} className={styles.leadRow}>
              <strong>{lead.title || "Untitled lead"}</strong>
              <span>{humanize(lead.stage, "No stage")}</span>
              <span>{humanize(lead.status, "No status")}</span>
              <small>{lead.source ? humanize(lead.source) : "Source unavailable"}</small>
            </div>
          )) : (
            <div className="admin-empty-state">
              <strong>No active leads</strong>
              <span>New qualified pipeline activity will appear here.</span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
