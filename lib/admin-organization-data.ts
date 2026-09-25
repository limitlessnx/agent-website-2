import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminOrganizationScope } from "@/lib/admin-organization-scope";

type MetricIcon = "leads" | "conversations" | "followups" | "qualified";

export type OrganizationHomeMetric = {
  label: string;
  value: number | string;
  detail: string;
  icon: MetricIcon;
};

export type OrganizationNotice = {
  title: string;
  detail: string;
  href: string;
  type: string;
};

export type OrganizationAgentCard = {
  name: string;
  role: string;
  channel: string;
  status: "live" | "attention" | "limited";
  href: string;
  note: string;
  metrics: Array<{ label: string; value: number | string }>;
};

export type OrganizationOperationalItem = {
  id: string;
  title: string;
  meta: string;
  label: string;
  href: string;
  tone: "conversation" | "automation" | "warning" | "muted";
};

export type OrganizationOperationalSnapshot = {
  organizationName: string;
  metrics: OrganizationHomeMetric[];
  notices: OrganizationNotice[];
  agents: OrganizationAgentCard[];
  conversations: OrganizationOperationalItem[];
  activity: OrganizationOperationalItem[];
  attentionCount: number;
};

function text(value: unknown, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function detailsValue(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  return text((value as Record<string, unknown>)[key]);
}

async function notificationNotices(organizationId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("dashboard_notifications")
    .select("id,title,message,severity,action_href,last_seen_at")
    .eq("organization_id", organizationId)
    .is("resolved_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(4);

  return (data || []).map((row) => ({
    title: text(row.title, "Organization notice"),
    detail: text(row.message, "Review this organization signal."),
    href: text(row.action_href, "/dashboard/activity"),
    type: text(row.severity, "attention"),
  }));
}

async function limitlessSnapshot(scope: AdminOrganizationScope): Promise<OrganizationOperationalSnapshot> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("leads")
    .select("id,name,phone,email,status,score,budget,location_preference,follow_up_stage,last_follow_up_at,last_contacted_at,created_at,updated_at")
    .eq("organization_id", scope.organizationId)
    .order("updated_at", { ascending: false })
    .limit(500);

  const leads = data || [];
  const active = leads.filter((lead) => !["closed", "converted", "cold", "opted_out"].includes(lower(lead.status)));
  const conversations = active.filter((lead) =>
    Boolean(lead.last_contacted_at) || ["in_conversation", "contacted", "engaged", "qualified"].some((state) => lower(lead.status).includes(state))
  );
  const followUps = active.filter((lead) => Boolean(lead.last_follow_up_at) || Number(lead.follow_up_stage || 0) > 0 || lower(lead.status).includes("follow"));
  const qualified = active.filter((lead) => ["hot", "high", "qualified", "ready"].includes(lower(lead.score)) || lower(lead.status).includes("qualified"));
  const notices = await notificationNotices(scope.organizationId);

  const items = active.slice(0, 12).map((lead) => ({
    id: String(lead.id),
    title: text(lead.name, "Unnamed lead"),
    meta: [lead.phone, lead.location_preference, lead.budget].map((value) => text(value)).filter(Boolean).join(" · ") || "Limitless Realty lead",
    label: text(lead.score || lead.status, "active"),
    href: "/dashboard/limitless/leads",
    tone: (qualified.some((item) => item.id === lead.id) || followUps.some((item) => item.id === lead.id) ? "warning" : "conversation") as OrganizationOperationalItem["tone"],
  }));

  return {
    organizationName: scope.name,
    metrics: [
      { label: "New leads", value: leads.filter((lead) => lower(lead.status) === "new").length, detail: "Entered the Limitless CRM", icon: "leads" },
      { label: "Conversations", value: conversations.length, detail: "Leads currently engaged", icon: "conversations" },
      { label: "Follow-ups", value: followUps.length, detail: "Leads needing continued contact", icon: "followups" },
      { label: "Qualified leads", value: qualified.length, detail: "Ready for the next sales step", icon: "qualified" },
    ],
    notices: [
      ...notices,
      ...followUps.slice(0, Math.max(0, 4 - notices.length)).map((lead) => ({
        title: `Follow up with ${text(lead.name, "lead")}`,
        detail: [lead.phone, lead.location_preference].map((value) => text(value)).filter(Boolean).join(" · ") || "Lead needs follow-up",
        href: "/dashboard/limitless/leads",
        type: "attention",
      })),
    ].slice(0, 4),
    agents: [{
      name: "Maia",
      role: "WhatsApp Sales Agent",
      channel: "WhatsApp · Limitless Realty",
      status: "live",
      href: "/dashboard/agents/maia",
      note: `${qualified.length} qualified · ${followUps.length} follow-ups · ${conversations.length} engaged`,
      metrics: [
        { label: "Leads", value: leads.length },
        { label: "Conversations", value: conversations.length },
        { label: "Follow-ups", value: followUps.length },
      ],
    }],
    conversations: items,
    activity: items,
    attentionCount: followUps.length,
  };
}

async function fluxknightSnapshot(scope: AdminOrganizationScope): Promise<OrganizationOperationalSnapshot> {
  const admin = createAdminClient();
  const [{ data: leads }, { data: conversations }, { data: socialPosts }, notices] = await Promise.all([
    admin.from("leo_public_leads").select("id,session_id,full_name,email,phone,company_name,status,handoff_requested,qualification,created_at,updated_at").order("updated_at", { ascending: false }).limit(250),
    admin.from("support_conversations").select("id,title,status,priority,summary,created_at,updated_at").order("updated_at", { ascending: false }).limit(250),
    admin.from("social_posts").select("id,title,status,platforms,created_at,updated_at").eq("organization_id", scope.organizationId).order("updated_at", { ascending: false }).limit(100),
    notificationNotices(scope.organizationId),
  ]);

  const leadRows = leads || [];
  const conversationRows = conversations || [];
  const posts = socialPosts || [];
  const followUps = leadRows.filter((lead) => Boolean(lead.handoff_requested) || lower(lead.status).includes("follow") || lower(lead.status).includes("pending"));
  const qualified = leadRows.filter((lead) => {
    const qualification = lead.qualification && typeof lead.qualification === "object" ? lead.qualification as Record<string, unknown> : {};
    return ["qualified", "hot", "ready"].some((state) => lower(lead.status).includes(state)) || lower(qualification.status).includes("qualified") || Number(qualification.score || 0) >= 70;
  });
  const reviewPosts = posts.filter((post) => ["review", "approved"].includes(lower(post.status)));

  const conversationItems: OrganizationOperationalItem[] = [
    ...leadRows.map((lead) => ({
      id: `lead-${lead.id}`,
      title: text(lead.full_name || lead.email || lead.phone, "Leo lead"),
      meta: [lead.company_name, lead.email, lead.phone].map((value) => text(value)).filter(Boolean).join(" · ") || "Captured by public Leo",
      label: text(lead.status, "lead"),
      href: "/dashboard/conversations",
      tone: (lead.handoff_requested ? "warning" : "conversation") as OrganizationOperationalItem["tone"],
    })),
    ...conversationRows.map((conversation) => ({
      id: `support-${conversation.id}`,
      title: text(conversation.title, "Leo conversation"),
      meta: text(conversation.summary, "Super Leo conversation"),
      label: text(conversation.status, "open"),
      href: "/dashboard/conversations",
      tone: (lower(conversation.priority) === "high" ? "warning" : "conversation") as OrganizationOperationalItem["tone"],
    })),
  ].slice(0, 12);

  const activity: OrganizationOperationalItem[] = [
    ...conversationItems,
    ...posts.slice(0, 6).map((post) => ({
      id: `social-${post.id}`,
      title: text(post.title, "Fluxknight social post"),
      meta: Array.isArray(post.platforms) ? post.platforms.join(", ") : "Social AI",
      label: text(post.status, "draft"),
      href: "/dashboard/social",
      tone: (["review", "approved"].includes(lower(post.status)) ? "warning" : "automation") as OrganizationOperationalItem["tone"],
    })),
  ].slice(0, 12);

  return {
    organizationName: scope.name,
    metrics: [
      { label: "Leads captured", value: leadRows.length, detail: "Prospects saved by public Leo", icon: "leads" },
      { label: "Conversations", value: conversationRows.length + new Set(leadRows.map((lead) => lead.session_id).filter(Boolean)).size, detail: "Leo conversation evidence", icon: "conversations" },
      { label: "Follow-ups", value: followUps.length, detail: "Prospects needing human follow-up", icon: "followups" },
      { label: "Qualified leads", value: qualified.length, detail: "Higher-intent Fluxknight prospects", icon: "qualified" },
    ],
    notices: [
      ...notices,
      ...followUps.slice(0, Math.max(0, 4 - notices.length)).map((lead) => ({
        title: `Follow up with ${text(lead.full_name || lead.company_name, "Fluxknight prospect")}`,
        detail: text(lead.email || lead.phone, "Leo requested a human handoff."),
        href: "/dashboard/conversations",
        type: "attention",
      })),
      ...reviewPosts.slice(0, 1).map((post) => ({
        title: "Social content needs review",
        detail: text(post.title, "A Fluxknight social post is waiting in the content pipeline."),
        href: "/dashboard/social/review",
        type: "attention",
      })),
    ].slice(0, 4),
    agents: [
      {
        name: "Leo",
        role: "Sales & Operations Intelligence",
        channel: "Fluxknight · Web + platform",
        status: "live",
        href: "/dashboard/conversations",
        note: `${leadRows.length} captured leads · ${followUps.length} follow-ups · ${conversationRows.length} support conversations`,
        metrics: [
          { label: "Leads", value: leadRows.length },
          { label: "Conversations", value: conversationRows.length },
          { label: "Follow-ups", value: followUps.length },
        ],
      },
      {
        name: "Flux Social",
        role: "Agentic Social Media",
        channel: "Fluxknight · Meta",
        status: reviewPosts.length ? "attention" : "live",
        href: "/dashboard/social",
        note: `${posts.length} posts · ${reviewPosts.length} in review/approval`,
        metrics: [
          { label: "Posts", value: posts.length },
          { label: "Review", value: reviewPosts.length },
          { label: "Published", value: posts.filter((post) => lower(post.status) === "published").length },
        ],
      },
    ],
    conversations: conversationItems,
    activity,
    attentionCount: followUps.length + reviewPosts.length,
  };
}

async function gencouvSnapshot(scope: AdminOrganizationScope): Promise<OrganizationOperationalSnapshot> {
  const admin = createAdminClient();
  const [{ data: leads }, { data: conversations }, { data: emails }, { data: enrollments }, notices] = await Promise.all([
    admin.from("gencouv_qualified_leads").select("id,full_name,email,company,quality_score,lifecycle_status,qualification_status,campaign_status,email_sequence_status,next_follow_up_at,reply_status,updated_at").eq("organization_id", scope.organizationId).order("updated_at", { ascending: false }).limit(500),
    admin.from("gencouv_support_conversations").select("id,customer_name,customer_email,status,last_intent,updated_at").order("updated_at", { ascending: false }).limit(200),
    admin.from("gencouv_email_messages").select("id,recipient_name,recipient_email,status,direction,subject,read_at,created_at,last_event_at").eq("organization_id", scope.organizationId).order("created_at", { ascending: false }).limit(300),
    admin.from("gencouv_campaign_enrollments").select("id,normalized_email,campaign_status,next_follow_up_at,reply_status,do_not_contact,last_event_at").eq("organization_id", scope.organizationId).order("updated_at", { ascending: false }).limit(300),
    notificationNotices(scope.organizationId),
  ]);

  const leadRows = leads || [];
  const conversationRows = conversations || [];
  const emailRows = emails || [];
  const enrollmentRows = enrollments || [];
  const followUps = enrollmentRows.filter((row) => Boolean(row.next_follow_up_at) && !row.do_not_contact && !["replied", "converted", "stopped"].some((state) => lower(row.reply_status || row.campaign_status).includes(state)));
  const qualified = leadRows.filter((lead) => lower(lead.qualification_status).includes("qualified") || Number(lead.quality_score || 0) >= 70);
  const inboundUnread = emailRows.filter((message) => lower(message.direction) === "inbound" && !message.read_at);

  const conversationItems: OrganizationOperationalItem[] = [
    ...conversationRows.map((conversation) => ({
      id: `support-${conversation.id}`,
      title: text(conversation.customer_name || conversation.customer_email, "Gencouv conversation"),
      meta: text(conversation.last_intent, "Gencouv support conversation"),
      label: text(conversation.status, "open"),
      href: "/dashboard/gencouv",
      tone: "conversation" as const,
    })),
    ...inboundUnread.map((message) => ({
      id: `email-${message.id}`,
      title: text(message.recipient_name || message.recipient_email, "Email reply"),
      meta: text(message.subject, "Inbound Gencouv email"),
      label: "unread",
      href: "/dashboard/gencouv",
      tone: "warning" as const,
    })),
  ].slice(0, 12);

  return {
    organizationName: scope.name,
    metrics: [
      { label: "Qualified leads", value: qualified.length, detail: "Validated Gencouv prospects", icon: "leads" },
      { label: "Conversations", value: conversationRows.length + inboundUnread.length, detail: "Support and inbound email activity", icon: "conversations" },
      { label: "Follow-ups", value: followUps.length, detail: "Campaign contacts due for nurture", icon: "followups" },
      { label: "Email activity", value: emailRows.length, detail: "Recent tracked email messages", icon: "qualified" },
    ],
    notices: [
      ...notices,
      ...inboundUnread.slice(0, Math.max(0, 4 - notices.length)).map((message) => ({
        title: "Gencouv email needs attention",
        detail: text(message.subject || message.recipient_email, "Unread inbound email"),
        href: "/dashboard/gencouv",
        type: "attention",
      })),
    ].slice(0, 4),
    agents: [
      {
        name: "Gencouv Support",
        role: "Client Support Agent",
        channel: "Gencouv · Web + Telegram",
        status: "live",
        href: "/dashboard/gencouv",
        note: `${conversationRows.length} support conversations · ${qualified.length} qualified leads`,
        metrics: [
          { label: "Conversations", value: conversationRows.length },
          { label: "Qualified", value: qualified.length },
          { label: "Follow-ups", value: followUps.length },
        ],
      },
      {
        name: "Email Automation",
        role: "Outbound Nurture",
        channel: "Gencouv · Resend",
        status: inboundUnread.length ? "attention" : "live",
        href: "/dashboard/gencouv",
        note: `${emailRows.length} tracked messages · ${inboundUnread.length} unread inbound`,
        metrics: [
          { label: "Messages", value: emailRows.length },
          { label: "Inbound", value: emailRows.filter((message) => lower(message.direction) === "inbound").length },
          { label: "Unread", value: inboundUnread.length },
        ],
      },
    ],
    conversations: conversationItems,
    activity: [
      ...conversationItems,
      ...leadRows.slice(0, 6).map((lead) => ({
        id: `lead-${lead.id}`,
        title: text(lead.full_name || lead.email, "Gencouv lead"),
        meta: [lead.company, lead.email].map((value) => text(value)).filter(Boolean).join(" · ") || "Qualified Gencouv lead",
        label: text(lead.qualification_status || lead.campaign_status, "qualified"),
        href: "/dashboard/gencouv",
        tone: "automation" as const,
      })),
    ].slice(0, 12),
    attentionCount: followUps.length + inboundUnread.length,
  };
}

async function tenantSnapshot(scope: AdminOrganizationScope): Promise<OrganizationOperationalSnapshot> {
  const admin = createAdminClient();
  const [{ data: leads }, { data: conversations }, notices] = await Promise.all([
    admin.from("crm_leads").select("id,customer_id,source,stage,score,summary,details,created_at,updated_at").eq("organization_id", scope.organizationId).order("updated_at", { ascending: false }).limit(300),
    admin.from("crm_conversations").select("id,customer_id,channel,status,started_at,updated_at,metadata").eq("organization_id", scope.organizationId).order("updated_at", { ascending: false }).limit(300),
    notificationNotices(scope.organizationId),
  ]);

  const leadRows = leads || [];
  const conversationRows = conversations || [];
  const followUps = leadRows.filter((lead) => lower(lead.stage).includes("follow") || Boolean(detailsValue(lead.details, "next_follow_up_at")));
  const qualified = leadRows.filter((lead) => lower(lead.stage).includes("qualified") || Number(lead.score || 0) >= 70);

  const items: OrganizationOperationalItem[] = conversationRows.slice(0, 12).map((conversation) => ({
    id: String(conversation.id),
    title: text(detailsValue(conversation.metadata, "customer_name"), "Client conversation"),
    meta: text(conversation.channel, "CRM") + " · " + text(conversation.status, "open"),
    label: text(conversation.status, "open"),
    href: "/dashboard/conversations",
    tone: "conversation",
  }));

  return {
    organizationName: scope.name,
    metrics: [
      { label: "Leads", value: leadRows.length, detail: "Leads in this tenant workspace", icon: "leads" },
      { label: "Conversations", value: conversationRows.length, detail: "Organization-scoped conversations", icon: "conversations" },
      { label: "Follow-ups", value: followUps.length, detail: "Leads requiring continued contact", icon: "followups" },
      { label: "Qualified leads", value: qualified.length, detail: "Higher-intent tenant leads", icon: "qualified" },
    ],
    notices,
    agents: [{
      name: "Workspace AI",
      role: "Organization Agent",
      channel: scope.name,
      status: "limited",
      href: "/dashboard/agents",
      note: "Showing only evidence stored for this tenant organization.",
      metrics: [
        { label: "Leads", value: leadRows.length },
        { label: "Conversations", value: conversationRows.length },
        { label: "Follow-ups", value: followUps.length },
      ],
    }],
    conversations: items,
    activity: items,
    attentionCount: followUps.length,
  };
}

export function emptyOrganizationOperationalSnapshot(organizationName: string): OrganizationOperationalSnapshot {
  return {
    organizationName,
    metrics: [
      { label: "Leads", value: 0, detail: "Live data temporarily unavailable", icon: "leads" },
      { label: "Conversations", value: 0, detail: "Live data temporarily unavailable", icon: "conversations" },
      { label: "Follow-ups", value: 0, detail: "Live data temporarily unavailable", icon: "followups" },
      { label: "Qualified leads", value: 0, detail: "Live data temporarily unavailable", icon: "qualified" },
    ],
    notices: [],
    agents: [{
      name: "AI workforce",
      role: "Organization agents",
      channel: organizationName,
      status: "limited",
      href: "/dashboard/agents",
      note: "Live operating data is temporarily unavailable. The workspace remains accessible.",
      metrics: [
        { label: "Leads", value: "—" },
        { label: "Conversations", value: "—" },
        { label: "Follow-ups", value: "—" },
      ],
    }],
    conversations: [],
    activity: [],
    attentionCount: 0,
  };
}

export async function getOrganizationOperationalSnapshot(scope: AdminOrganizationScope) {
  if (scope.kind === "system" && scope.systemId === "limitless-realty") return limitlessSnapshot(scope);
  if (scope.kind === "system" && scope.systemId === "gencouv") return gencouvSnapshot(scope);
  if (scope.kind === "system" && scope.systemId === "fluxknight") return fluxknightSnapshot(scope);
  return tenantSnapshot(scope);
}
