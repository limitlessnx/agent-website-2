import { requireTenant } from "@/lib/tenant";
import styles from "./CustomerOperations.module.css";

export const dynamic = "force-dynamic";

type ConversationMetadata = Record<string, unknown> | null;

type Customer = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
};

type Lead = {
  id: string;
  title: string | null;
  status: string | null;
  stage: string | null;
  source: string | null;
  created_at: string;
  customer_id: string | null;
};

type Conversation = {
  status: string | null;
  priority: string | null;
  metadata: ConversationMetadata;
};

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

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function conversationBelongsToCustomer(conversation: Conversation, customer: Customer) {
  const metadata = conversation.metadata;
  if (!metadata) return false;

  const metadataCustomerId = textFromMetadata(metadata, ["customer_id", "customerId", "crm_customer_id", "crmCustomerId"]);
  if (metadataCustomerId && metadataCustomerId === customer.id) return true;

  const candidates = [
    textFromMetadata(metadata, ["customer_name", "customerName", "name", "contact_name", "contactName"]),
    textFromMetadata(metadata, ["email", "customer_email", "customerEmail", "contact_email", "contactEmail"]),
    textFromMetadata(metadata, ["phone", "customer_phone", "customerPhone", "contact_phone", "contactPhone"]),
  ].map(normalize).filter(Boolean);

  return [customer.display_name, customer.email, customer.phone]
    .map(normalize)
    .filter(Boolean)
    .some((value) => candidates.includes(value));
}

function nextAction(customer: Customer, linkedLeads: Lead[], linkedConversations: Conversation[]) {
  const urgentConversation = linkedConversations.find((conversation) => ["critical", "high"].includes(normalize(conversation.priority)) && !["resolved", "closed"].includes(normalize(conversation.status)));
  if (urgentConversation) return "Respond to the highest-priority open conversation before advancing the pipeline.";

  const activeLead = linkedLeads.find((lead) => !["closed", "lost", "converted"].includes(normalize(lead.status)));
  if (activeLead) {
    const stage = humanize(activeLead.stage, "current").toLowerCase();
    return `Advance the ${stage} lead with the next appropriate follow-up.`;
  }

  if (normalize(customer.status) === "active") return "Maintain the relationship and watch for the next measurable opportunity or support signal.";
  return "Review the customer record and decide whether follow-up, reactivation or closure is appropriate.";
}

export default async function CrmPage() {
  const { supabase, organizationId } = await requireTenant();
  const [{ data: customersData }, { data: leadsData }, conversationResult] = await Promise.all([
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

  const customers = (customersData || []) as Customer[];
  const leads = (leadsData || []) as Lead[];
  const conversations = (conversationResult.data || []) as Conversation[];
  const activeConversations = conversations.filter((conversation) => !["resolved", "closed"].includes(normalize(conversation.status)));
  const urgentConversations = activeConversations.filter((conversation) => ["high", "critical"].includes(normalize(conversation.priority)));
  const openLeads = leads.filter((lead) => !["closed", "lost", "converted"].includes(normalize(lead.status)));

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
        <div><span>Customers</span><strong>{customers.length}</strong></div>
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
              <p>Open a customer to see their linked pipeline, conversation context and next operating move.</p>
            </div>
            <span>{customers.length} total</span>
          </header>

          <div className={styles.customerList}>
            {customers.length ? customers.map((customer) => {
              const linkedLeads = leads.filter((lead) => lead.customer_id === customer.id);
              const linkedConversations = conversations.filter((conversation) => conversationBelongsToCustomer(conversation, customer));
              const openLinkedConversations = linkedConversations.filter((conversation) => !["resolved", "closed"].includes(normalize(conversation.status)));
              const action = nextAction(customer, linkedLeads, linkedConversations);

              return (
                <details key={customer.id} className={styles.customerRecord}>
                  <summary className={styles.customerRow}>
                    <div className={styles.identity}>
                      <strong>{customer.display_name || customer.email || customer.phone || "Unnamed customer"}</strong>
                      <span>{customer.email || customer.phone || "No contact detail saved"}</span>
                    </div>
                    <div className={styles.rowMeta}>
                      <span data-status={normalize(customer.status)}>{humanize(customer.status, "No status")}</span>
                      <small>{linkedLeads.length} lead{linkedLeads.length === 1 ? "" : "s"} · {openLinkedConversations.length} open conversation{openLinkedConversations.length === 1 ? "" : "s"}</small>
                    </div>
                  </summary>

                  <div className={styles.customerDetail}>
                    <div className={styles.detailOverview}>
                      <div>
                        <span>Next action</span>
                        <strong>{action}</strong>
                      </div>
                      <div>
                        <span>Relationship</span>
                        <strong>{humanize(customer.status, "No status")}</strong>
                      </div>
                    </div>

                    <div className={styles.detailGrid}>
                      <section>
                        <header>
                          <span>Pipeline</span>
                          <small>{linkedLeads.length} linked</small>
                        </header>
                        {linkedLeads.length ? linkedLeads.slice(0, 5).map((lead) => (
                          <div key={lead.id} className={styles.detailRow}>
                            <div>
                              <strong>{lead.title || "Untitled lead"}</strong>
                              <span>{lead.source ? humanize(lead.source) : "Source unavailable"}</span>
                            </div>
                            <small>{humanize(lead.stage, "No stage")} · {humanize(lead.status, "No status")}</small>
                          </div>
                        )) : <p className={styles.detailEmpty}>No linked lead record.</p>}
                      </section>

                      <section>
                        <header>
                          <span>Conversations</span>
                          <small>{openLinkedConversations.length} open</small>
                        </header>
                        {linkedConversations.length ? linkedConversations.slice(0, 5).map((conversation, index) => {
                          const metadata = conversation.metadata;
                          const subject = textFromMetadata(metadata, ["subject", "topic", "summary", "title"]);
                          const channel = textFromMetadata(metadata, ["channel", "source", "provider"]);
                          return (
                            <div key={`${customer.id}-conversation-${index}`} className={styles.detailRow}>
                              <div>
                                <strong>{subject || "Customer conversation"}</strong>
                                <span>{channel ? humanize(channel) : "Channel unavailable"}</span>
                              </div>
                              <small data-priority={normalize(conversation.priority)}>{humanize(conversation.priority, "Normal")} · {humanize(conversation.status, "Open")}</small>
                            </div>
                          );
                        }) : <p className={styles.detailEmpty}>No linked conversation context found.</p>}
                      </section>
                    </div>
                  </div>
                </details>
              );
            }) : (
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
                return (rank[normalize(b.priority)] || 0) - (rank[normalize(a.priority)] || 0);
              })
              .slice(0, 12)
              .map((conversation, index) => {
                const metadata = conversation.metadata;
                const customer = textFromMetadata(metadata, ["customer_name", "customerName", "name", "contact_name", "contactName"]);
                const subject = textFromMetadata(metadata, ["subject", "topic", "summary", "title"]);
                const channel = textFromMetadata(metadata, ["channel", "source", "provider"]);
                const priority = normalize(conversation.priority) || "normal";
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
