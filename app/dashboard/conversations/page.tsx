import { AlertTriangle, CheckCircle2, MessageSquareText, PhoneCall, UserCheck } from "@/components/admin/ServerIcons";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { getOrganizationConversationCenter, type ConversationCenterItem } from "@/lib/organization-conversation-center";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  if (!value || value === new Date(0).toISOString()) return "No timestamp";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function sourceCopy(source: "leo" | "maia" | "gencouv") {
  if (source === "maia") return { kicker: "LIMITLESS REALTY", title: "Maia client conversations", description: "Only client-facing WhatsApp conversations handled by Maia are shown here." };
  if (source === "gencouv") return { kicker: "GENCOUV", title: "Gencouv website conversations", description: "Only conversations started on the public Gencouv website are shown here." };
  return { kicker: "FLUXKNIGHT", title: "Leo public conversations", description: "Only conversations started through the public Leo website flow are shown here." };
}

export default async function ConversationsPage() {
  const scope = await resolveAdminOrganizationScope();
  const systemId = scope.systemId;
  const supported = systemId === "fluxknight" || systemId === "limitless-realty" || systemId === "gencouv";
  const conversations = supported ? await getOrganizationConversationCenter(systemId, scope.organizationId).catch(() => []) : [];
  const selected = conversations[0] || null;
  const source = systemId === "limitless-realty" ? "maia" : systemId === "gencouv" ? "gencouv" : "leo";
  const copy = sourceCopy(source);

  return (
    <main className={"admin-page dashboard-v2-page conversations-page conversation-center-" + (systemId || "tenant")}>
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <span className={conversations.length ? "admin-status live" : "admin-status warning"}>
          {conversations.length ? conversations.length + " client conversations" : "No client conversations yet"}
        </span>
      </header>

      <div className="admin-metric-grid">
        <section className="admin-panel compact"><p>Client conversations</p><strong>{conversations.length}</strong><span className="admin-muted">Public/agent channel only</span></section>
        <section className="admin-panel compact"><p>Needs attention</p><strong>{conversations.filter((item) => ["high", "critical", "pending", "handoff"].some((flag) => item.status.toLowerCase().includes(flag)) || item.label.toLowerCase().includes("handoff")).length}</strong><span className="admin-muted">Handoff or active follow-up signals</span></section>
        <section className="admin-panel compact"><p>Source</p><strong>{systemId === "limitless-realty" ? "WhatsApp" : "Website"}</strong><span className="admin-muted">{scope.name} workspace only</span></section>
        <section className="admin-panel compact"><p>Private chats</p><strong>Excluded</strong><span className="admin-muted">Internal agent/admin conversations stay separate</span></section>
      </div>

      <section className="admin-panel conversation-workspace" aria-label="Client conversation workspace">
        <aside className="conversation-pane">
          <div className="conversation-pane-head"><div><h2>Client inbox</h2><p>{copy.description}</p></div><MessageSquareText size={17} /></div>
          <div className="admin-list conversation-list">
            {conversations.map((item, index) => (
              <a href={"#conversation-" + item.id} className={"admin-list-row compact conversation-row " + (index === 0 ? "is-selected" : "")} key={item.id}>
                <div><strong>{item.customerName}</strong><span>{item.contact} · {item.channel}</span></div>
                <em className={item.label.toLowerCase().includes("handoff") ? "bad" : "muted"}>{item.label}</em>
              </a>
            ))}
            {!conversations.length ? <p className="admin-empty">No public client conversation has been captured for {scope.name} yet.</p> : null}
          </div>
        </aside>

        <section className="conversation-pane">
          <div className="conversation-pane-head">
            <div><h2>{selected?.customerName || "Conversation"}</h2><p>{selected ? selected.channel + " · " + selected.contact : "Select a client conversation from the inbox."}</p></div>
            {selected ? <span className="admin-status live">{selected.status}</span> : null}
          </div>
          {selected ? (
            <div className="conversation-thread" id={"conversation-" + selected.id}>
              {selected.messages.length ? selected.messages.map((message) => (
                <div className={"conversation-bubble " + (message.role === "agent" ? "ai" : "")} key={message.id}>
                  <span className="conversation-role">{message.role === "agent" ? selected.agent : message.role === "customer" ? selected.customerName : message.role}</span>
                  <p>{message.content}</p>
                  <small>{formatDate(message.created_at)}</small>
                </div>
              )) : <div className="conversation-bubble ai"><p>{selected.summary}</p><small>{formatDate(selected.updatedAt)}</small></div>}
            </div>
          ) : <div className="admin-empty-state"><div><MessageSquareText size={20} /><p>No client conversation selected.</p></div></div>}
        </section>

        <aside className="conversation-pane">
          <div className="conversation-pane-head"><div><h2>Client context</h2><p>Follow-up information for the selected public conversation.</p></div><PhoneCall size={17} /></div>
          {selected ? (
            <>
              <div className="conversation-context-card"><span className="admin-kicker">CLIENT</span><strong>{selected.customerName}</strong><span className="admin-muted">{selected.contact}</span></div>
              {selected.company ? <div className="conversation-context-card"><span className="admin-kicker">BUSINESS</span><strong>{selected.company}</strong></div> : null}
              <div className="conversation-context-card"><span className="admin-kicker">AGENT</span><strong>{selected.agent}</strong><span className="admin-muted">{selected.channel}</span></div>
              <div className="conversation-context-card"><span className="admin-kicker">LAST ACTIVITY</span><strong>{formatDate(selected.updatedAt)}</strong><span className="admin-muted">{selected.summary}</span></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {selected.contact.includes("@") ? <a className="admin-button secondary-button" href={"mailto:" + selected.contact}><UserCheck size={14} /> Email</a> : null}
                {!selected.contact.includes("@") ? <a className="admin-button secondary-button" href={"tel:" + selected.contact}><PhoneCall size={14} /> Call</a> : null}
              </div>
            </>
          ) : <div className="admin-empty-state"><div><AlertTriangle size={20} /><p>There is no client context to display yet.</p></div></div>}
        </aside>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Scope guardrail</h2><p>Internal dashboard conversations are deliberately excluded from this center.</p></div><CheckCircle2 size={18} /></div>
        <div className="admin-list-row compact"><div><strong>{scope.name} client channel</strong><span>{copy.description}</span></div><em>Tenant isolated</em></div>
      </section>

      <style>{`
        .conversation-center-fluxknight{--conversation-accent:#a78bfa}.conversation-center-limitless-realty{--conversation-accent:#34d399}.conversation-center-gencouv{--conversation-accent:#38bdf8}
        .conversation-center-fluxknight .conversation-row.is-selected,.conversation-center-limitless-realty .conversation-row.is-selected,.conversation-center-gencouv .conversation-row.is-selected{border-color:var(--conversation-accent)}
        .conversation-thread{display:grid;gap:10px;max-height:620px;overflow:auto;padding:4px}
        .conversation-bubble{max-width:86%;padding:12px 14px;border:1px solid rgba(167,139,250,.16);border-radius:13px;background:rgba(255,255,255,.025);justify-self:start}
        .conversation-bubble.ai{justify-self:end;background:rgba(167,139,250,.07);border-color:var(--conversation-accent)}
        .conversation-bubble p{margin:4px 0 0;color:#ddd6e7;line-height:1.6;white-space:pre-wrap}
        .conversation-bubble small,.conversation-role{display:block;color:#8f83a4;font-size:.68rem}
        .conversation-role{font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--conversation-accent)}
        @media(max-width:900px){.conversation-workspace{grid-template-columns:1fr}.conversation-thread{max-height:480px}}
      `}</style>
    </main>
  );
}
