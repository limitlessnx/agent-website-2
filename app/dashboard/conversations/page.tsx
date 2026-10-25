import { AlertTriangle, MessageSquareText } from "@/components/admin/ServerIcons";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { getOrganizationConversationCenter, getTenantConversationCenter } from "@/lib/organization-conversation-center";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined) {
  if (!value || value === new Date(0).toISOString()) return "No timestamp";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function sourceCopy(systemId: string | null | undefined) {
  if (systemId === "limitless-realty") return { kicker: "LIMITLESS REALTY", title: "Maia client conversations", description: "Client-facing WhatsApp conversations handled by Maia." };
  if (systemId === "gencouv") return { kicker: "GENCOUV", title: "Gencouv website conversations", description: "Conversations started on the public Gencouv website." };
  return { kicker: "FLUXKNIGHT", title: "Leo public conversations", description: "Conversations started through the public Leo website flow." };
}

export default async function ConversationsPage() {
  const scope = await resolveAdminOrganizationScope();
  const systemId = scope.systemId;
  const supported = systemId === "fluxknight" || systemId === "limitless-realty" || systemId === "gencouv";
  const conversations = scope.kind === "tenant"
    ? await getTenantConversationCenter(scope.organizationId).catch(() => [])
    : supported
      ? await getOrganizationConversationCenter(systemId, scope.organizationId).catch(() => [])
      : [];
  const copy = scope.kind === "tenant"
    ? { kicker: scope.name.toUpperCase(), title: "Client conversations", description: "Client conversations and message history for this organization only." }
    : sourceCopy(systemId);
  const needsAttention = conversations.filter((item) =>
    ["high", "critical", "pending", "handoff"].some((flag) => item.status.toLowerCase().includes(flag)) ||
    item.label.toLowerCase().includes("handoff")
  ).length;

  return (
    <main className={"admin-page dashboard-v2-page conversations-page conversation-center-" + (systemId || "tenant")}>
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description} Select a conversation to expand its message history.</p>
        </div>
        <span className={conversations.length ? "admin-status live" : "admin-status warning"}>
          {conversations.length ? conversations.length + " client conversations" : "No client conversations yet"}
        </span>
      </header>

      <div className="admin-metric-grid conversation-metrics">
        <section className="admin-panel compact"><p>Client conversations</p><strong>{conversations.length}</strong></section>
        <section className="admin-panel compact"><p>Needs attention</p><strong>{needsAttention}</strong></section>
        <section className="admin-panel compact"><p>Workspace</p><strong>{scope.name}</strong></section>
      </div>

      {/* Internal dashboard conversations are deliberately excluded; this center only renders tenant-scoped public/client records. */}
      <section className="admin-panel conversation-accordion" aria-label="Client conversations">
        <div className="admin-panel-header">
          <div><h2>Client inbox</h2><p>Each conversation stays collapsed until you open it.</p></div>
          <MessageSquareText size={18} />
        </div>
        {conversations.map((item) => (
          <details className="conversation-disclosure" key={item.id}>
            <summary>
              <span className="conversation-summary-main">
                <strong>{item.customerName || "Unknown client"}</strong>
                <span>{item.contact} · {item.channel}</span>
              </span>
              <span className="conversation-summary-meta">
                <em className={item.label.toLowerCase().includes("handoff") ? "bad" : "muted"}>{item.label || item.status}</em>
                <span>{formatDate(item.updatedAt)}</span>
              </span>
            </summary>
            <div className="conversation-expanded">
              <div className="conversation-expanded-heading">
                <div><strong>{item.customerName || "Client conversation"}</strong><span>{item.agent} · {item.status}</span></div>
                {item.contact.includes("@")
                  ? <a className="admin-button secondary-button" href={"mailto:" + item.contact}>Email client</a>
                  : <a className="admin-button secondary-button" href={"tel:" + item.contact}>Call client</a>}
              </div>
              {item.company ? <p className="conversation-company">Business: {item.company}</p> : null}
              <div className="conversation-thread">
                {item.messages.length ? item.messages.map((message) => (
                  <div className={"conversation-bubble " + (message.role === "agent" ? "ai" : "")} key={message.id}>
                    <span className="conversation-role">{message.role === "agent" ? item.agent : message.role === "customer" ? item.customerName : message.role}</span>
                    <p>{message.content}</p>
                    <small>{formatDate(message.created_at)}</small>
                  </div>
                )) : (
                  <div className="conversation-bubble ai">
                    <span className="conversation-role">Conversation summary</span>
                    <p>{item.summary || "No message history is available for this conversation."}</p>
                    <small>{formatDate(item.updatedAt)}</small>
                  </div>
                )}
              </div>
            </div>
          </details>
        ))}
        {!conversations.length ? <div className="admin-empty-state"><div><AlertTriangle size={20} /><p>No public client conversation has been captured for {scope.name} yet.</p></div></div> : null}
      </section>

      <style>{`
        .conversation-center-fluxknight{--conversation-accent:#a78bfa}
        .conversation-center-limitless-realty{--conversation-accent:#34d399}
        .conversation-center-gencouv{--conversation-accent:#38bdf8}
        .conversation-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}
        .conversation-accordion{display:grid;gap:0}
        .conversation-disclosure{border-top:1px solid rgba(255,255,255,.09)}
        .conversation-disclosure:first-of-type{border-top:0}
        .conversation-disclosure summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 4px;cursor:pointer;list-style:none}
        .conversation-disclosure summary::-webkit-details-marker{display:none}
        .conversation-disclosure summary:after{content:"+";font-size:1.25rem;color:var(--conversation-accent);margin-left:8px}
        .conversation-disclosure[open] summary:after{content:"−"}
        .conversation-summary-main,.conversation-summary-meta{display:flex;flex-direction:column;gap:5px;min-width:0}
        .conversation-summary-main strong{font-size:.95rem}
        .conversation-summary-main span,.conversation-summary-meta span{color:var(--admin-muted,#9ca3af);font-size:.78rem;overflow-wrap:anywhere}
        .conversation-summary-meta{align-items:flex-end;text-align:right}
        .conversation-summary-meta em{font-size:.72rem;font-style:normal}
        .conversation-expanded{padding:0 4px 18px}
        .conversation-expanded-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:4px 0 12px}
        .conversation-expanded-heading div{display:grid;gap:4px}
        .conversation-expanded-heading span,.conversation-company{font-size:.8rem;color:var(--admin-muted,#9ca3af)}
        .conversation-thread{display:grid;gap:10px;max-height:520px;overflow:auto;padding:4px}
        .conversation-bubble{max-width:86%;padding:12px 14px;border:1px solid rgba(167,139,250,.16);border-radius:13px;background:rgba(255,255,255,.025);justify-self:start}
        .conversation-bubble.ai{justify-self:end;background:rgba(167,139,250,.07);border-color:var(--conversation-accent)}
        .conversation-bubble p{margin:4px 0 0;color:#ddd6e7;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
        .conversation-bubble small,.conversation-role{display:block;color:#8f83a4;font-size:.68rem}
        .conversation-role{font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--conversation-accent)}
        @media(max-width:700px){.conversation-metrics{grid-template-columns:1fr}.conversation-disclosure summary{align-items:flex-start}.conversation-summary-meta{max-width:45%}.conversation-bubble{max-width:96%}}
      `}</style>
    </main>
  );
}
