import { createAdminClient } from "@/lib/supabase/admin";

export type ConversationCenterMessage = {
  id: string;
  role: string;
  direction?: string | null;
  content: string;
  created_at: string;
};

export type ConversationCenterItem = {
  id: string;
  source: "leo" | "maia" | "gencouv";
  agent: string;
  customerName: string;
  contact: string;
  company?: string | null;
  channel: string;
  status: string;
  label: string;
  updatedAt: string;
  summary: string;
  messages: ConversationCenterMessage[];
};

function text(value: unknown, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function roleLabel(role: unknown) {
  const value = text(role, "message").toLowerCase();
  if (value === "user" || value === "customer") return "customer";
  if (value === "assistant" || value === "agent") return "agent";
  return value;
}

async function crmMessages(admin: ReturnType<typeof createAdminClient>, organizationId: string, conversationIds: string[]) {
  if (!conversationIds.length) return new Map<string, ConversationCenterMessage[]>();
  const { data } = await admin
    .from("crm_messages")
    .select("id,conversation_id,direction,content,created_at,sender_type")
    .eq("organization_id", organizationId)
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true })
    .limit(2000);
  const grouped = new Map<string, ConversationCenterMessage[]>();
  for (const row of data || []) {
    const list = grouped.get(String(row.conversation_id)) || [];
    list.push({
      id: String(row.id),
      role: roleLabel(row.sender_type),
      direction: row.direction,
      content: text(row.content),
      created_at: String(row.created_at),
    });
    grouped.set(String(row.conversation_id), list);
  }
  return grouped;
}

async function fluxknightConversations(admin: ReturnType<typeof createAdminClient>, organizationId: string): Promise<ConversationCenterItem[]> {
  const { data: leads } = await admin
    .from("leo_public_leads")
    .select("id,session_id,customer_id,conversation_id,full_name,email,phone,company_name,status,handoff_requested,notes,updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(100);

  const leadRows = leads || [];
  const conversationIds = leadRows.map((lead) => text(lead.conversation_id)).filter(Boolean);
  const messages = await crmMessages(admin, organizationId, conversationIds);

  return leadRows.map((lead) => {
    const id = text(lead.conversation_id) || "leo-lead-" + String(lead.id);
    const thread = messages.get(text(lead.conversation_id)) || [];
    const latest = thread[thread.length - 1];
    return {
      id,
      source: "leo",
      agent: "Leo",
      customerName: text(lead.full_name, "Website visitor"),
      contact: text(lead.email || lead.phone, "Contact not captured"),
      company: lead.company_name,
      channel: "Public website",
      status: text(lead.status, "new"),
      label: lead.handoff_requested ? "Human handoff requested" : "Public Leo",
      updatedAt: text(lead.updated_at, new Date(0).toISOString()),
      summary: text(latest?.content || lead.notes, "Conversation captured from the public Leo flow."),
      messages: thread,
    };
  });
}

async function limitlessConversations(admin: ReturnType<typeof createAdminClient>, organizationId: string): Promise<ConversationCenterItem[]> {
  const { data: conversations } = await admin
    .from("crm_conversations")
    .select("id,customer_id,channel,status,metadata,updated_at")
    .eq("organization_id", organizationId)
    .eq("channel", "whatsapp")
    .eq("metadata->>source", "maia-whatsapp-runtime")
    .order("updated_at", { ascending: false })
    .limit(100);

  const rows = conversations || [];
  const customerIds = rows.map((row) => text(row.customer_id)).filter(Boolean);
  const { data: customers } = customerIds.length
    ? await admin.from("crm_customers").select("id,full_name,email,phone,company_name").eq("organization_id", organizationId).in("id", customerIds)
    : { data: [] as any[] };
  const customerMap = new Map((customers || []).map((customer) => [String(customer.id), customer]));
  const messages = await crmMessages(admin, organizationId, rows.map((row) => String(row.id)));

  return rows.map((row) => {
    const customer = customerMap.get(String(row.customer_id));
    const thread = messages.get(String(row.id)) || [];
    const latest = thread[thread.length - 1];
    return {
      id: String(row.id),
      source: "maia",
      agent: "Maia",
      customerName: text(customer?.full_name, "WhatsApp client"),
      contact: text(customer?.phone || customer?.email, "Contact not captured"),
      company: customer?.company_name,
      channel: "WhatsApp",
      status: text(row.status, "open"),
      label: "Maia client conversation",
      updatedAt: text(row.updated_at, new Date(0).toISOString()),
      summary: text(latest?.content, "WhatsApp conversation with Maia."),
      messages: thread,
    };
  });
}

async function gencouvConversations(admin: ReturnType<typeof createAdminClient>): Promise<ConversationCenterItem[]> {
  const { data } = await admin
    .from("gencouv_support_conversations")
    .select("id,session_id,customer_email,customer_name,page_url,status,last_intent,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  const rows = data || [];
  const ids = rows.map((row) => String(row.id));
  const { data: messageRows } = ids.length
    ? await admin.from("gencouv_support_messages").select("id,conversation_id,role,content,created_at").in("conversation_id", ids).order("created_at", { ascending: true }).limit(2000)
    : { data: [] as any[] };
  const grouped = new Map<string, ConversationCenterMessage[]>();
  for (const row of messageRows || []) {
    const list = grouped.get(String(row.conversation_id)) || [];
    list.push({ id: String(row.id), role: roleLabel(row.role), content: text(row.content), created_at: String(row.created_at) });
    grouped.set(String(row.conversation_id), list);
  }

  return rows.map((row) => {
    const thread = grouped.get(String(row.id)) || [];
    const latest = thread[thread.length - 1];
    return {
      id: String(row.id),
      source: "gencouv",
      agent: "Gencouv",
      customerName: text(row.customer_name, "Website visitor"),
      contact: text(row.customer_email, "Email not captured"),
      channel: "Gencouv website",
      status: text(row.status, "open"),
      label: "Public Gencouv conversation",
      updatedAt: text(row.updated_at, new Date(0).toISOString()),
      summary: text(latest?.content || row.last_intent, "Conversation from the public Gencouv website."),
      messages: thread,
    };
  });
}

export async function getOrganizationConversationCenter(systemId: "fluxknight" | "limitless-realty" | "gencouv", organizationId: string) {
  const admin = createAdminClient();
  if (systemId === "fluxknight") return fluxknightConversations(admin, organizationId);
  if (systemId === "limitless-realty") return limitlessConversations(admin, organizationId);
  return gencouvConversations(admin);
}
