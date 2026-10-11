import { AlertTriangle, CheckCircle2, MessageSquareText } from "@/components/admin/ServerIcons";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { getOrganizationConversationCenter } from "@/lib/organization-conversation-center";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  if (!value || value === new Date(0).toISOString()) return "No timestamp";
  return new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function sourceCopy(source: "leo" | "maia" | "gencouv") {
  if (source === "maia") return { kicker: "LIMITLESS REALTY", title: "Maia client conversations", description: "Client-facing WhatsApp conversations handled by Maia." };
  if (source === "gencouv") return { kicker: "GENCOUV", title: "Gencouv website conversations", description: "Conversations started on the public Gencouv website." };
  return { kicker: "FLUXKNIGHT", title: "Leo public conversations", description: "Conversations started through the public Leo website flow." };
}

export default async function ConversationsPage() {
  const scope = await resolveAdminOrganizationScope();
  const systemId = scope.systemId;
  const supported = systemId === "fluxknight" || systemId === "limitless-realty" || systemId === "gencouv";
  const conversations = supported ? await getOrganizationConversationCenter(systemId, scope.organizationId).catch(() => []) : [];
  const source = systemId === "limitless-realty" ? "maia" : systemId === "gencouv" ? "gencouv" : "leo";
  const copy = sourceCopy(source);
  const needsAttention = conversations.filter((item) => ["high", "critical", "pending", "handoff"].some((flag) => item.status.toLowerCase().includes(flag)) || item.label.toLowerCase().includes("handoff")).length;

  return (
    <main className={"admin-page dashboard-v2-page conversations-page conversation-center-" + (systemId || "tenant")}>
      <header className="admin-page-header">
        <div><p className="admin-kicker">{copy.kicker}</p><h1>{copy.title}</h1><p>{copy.description}</p></div>
        <span className={conversations.length ? "admin-status live" : "admin-status warning"}>{conversations.length ? conversations.length + " client conversations" : "No client conversations yet"}</span>
      </header>

      <div className="admin-metric-grid">
        <section className="admin-panel compact"><p>Client conversations</p><strong>{conversations.length}</strong><span className="admin-muted">Client-facing messages only</span></section>
        <section className="admin-panel compact"><p>Needs attention</p><strong>{needsAttention}</strong><span className="admin-muted">Handoff or follow-up signals</span></section>
        <section className="admin-panel compact"><p>Source</p><strong>{systemId === "limitless-realty" ? "WhatsApp" : "Website"}</strong><span className="admin-muted">{scope.name} workspace only</span></section>
        <section className="admin-panel compact"><p>Private chats</p><strong>Excluded</strong><span className="admin-muted">Internal agent/admin conversations stay separate</span></section>
      </div>

      <section className="admin-panel conversation-inbox" aria-label="Client conversation inbox">
        <header className="conversation-inbox-head"><div><h2>Client inbox</h2><p>Tap a contact's name to open their conversation and summary. Only one conversation stays expanded at a time.</p></div><MessageSquareText size={19} /></header>
        {conversations.length ? <div className="conversation-accordion">
          {conversations.map((item) => (
            <details className="conversation-contact" key={item.id}>
              <summary className="conversation-contact-summary">
                <span className="conversation-avatar" aria-hidden="true">{item.customerName.trim().charAt(0).toUpperCase() || "C"}</span>
                <span className="conversation-contact-main">
                  <strong>{item.customerName}</strong>
                  <span>{item.contact} <i>·</i> {item.channel}</span>
                  <small>{item.messages[item.messages.length - 1]?.content || item.summary}</small>
                </span>
                <span className="conversation-contact-meta"><em className={item.label.toLowerCase().includes("handoff") || item.status.toLowerCase().includes("pending") ? "needs-attention" : ""}>{item.status || item.label}</em><small>{formatDate(item.updatedAt)}</small><span className="conversation-chevron" aria-hidden="true">⌄</span></span>
              </summary>
              <div className="conversation-expanded">
                <div className="conversation-summary-card"><span className="admin-kicker">CONVERSATION SUMMARY</span><p>{item.summary || "No summary has been recorded for this conversation yet."}</p></div>
                <div className="conversation-detail-grid">
                  <div><span>Contact</span><strong>{item.contact}</strong></div>
                  <div><span>Channel</span><strong>{item.channel}</strong></div>
                  <div><span>Handled by</span><strong>{item.agent}</strong></div>
                  <div><span>Last activity</span><strong>{formatDate(item.updatedAt)}</strong></div>
                  {item.company ? <div><span>Business</span><strong>{item.company}</strong></div> : null}
                </div>
                <div className="conversation-history-head"><h3>Message history</h3><span>{item.messages.length} messages</span></div>
                {item.messages.length ? <div className="conversation-thread">
                  {item.messages.map((message) => (
                    <article className={"conversation-bubble " + (message.role === "agent" ? "from-agent" : "from-client")} key={message.id}>
                      <span className="conversation-role">{message.role === "agent" ? item.agent : message.role === "customer" ? item.customerName : message.role}</span>
                      <p>{message.content || "No message content"}</p>
                      <small>{formatDate(message.created_at)}</small>
                    </article>
                  ))}
                </div> : <p className="conversation-no-messages">No individual messages are stored for this conversation. The summary above is the available record.</p>}
                <div className="conversation-actions">
                  {item.contact.includes("@") ? <a className="admin-button secondary-button" href={"mailto:" + item.contact}>Email client</a> : null}
                  {!item.contact.includes("@") && item.contact !== "Contact not captured" ? <a className="admin-button secondary-button" href={"tel:" + item.contact}>Call client</a> : null}
                </div>
              </div>
            </details>
          ))}
        </div> : <div className="admin-empty-state"><div><AlertTriangle size={20} /><p>No public client conversation has been captured for {scope.name} yet.</p></div></div>}
      </section>

      <section className="admin-panel conversation-scope-note">
        <div className="admin-panel-header"><div><h2>Workspace privacy</h2><p>Only conversations belonging to the selected organization are shown. Internal dashboard chats remain separate.</p></div><CheckCircle2 size={18} /></div>
        <div className="admin-list-row compact"><div><strong>{scope.name} client channel</strong><span>{copy.description}</span></div><em>Tenant isolated</em></div>
      </section>

      <style>{`
        .conversation-center-fluxknight{--conversation-accent:#a78bfa}.conversation-center-limitless-realty{--conversation-accent:#a855f7}.conversation-center-gencouv{--conversation-accent:#38bdf8}
        .conversation-inbox{padding:0;overflow:hidden}.conversation-inbox-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 22px;border-bottom:1px solid rgba(167,139,250,.16)}.conversation-inbox-head h2{margin:0;font-size:1.05rem}.conversation-inbox-head p{margin:5px 0 0;color:var(--muted,#a69bb7);font-size:.85rem;line-height:1.5}
        .conversation-accordion{display:grid}.conversation-contact{border-bottom:1px solid rgba(167,139,250,.12)}.conversation-contact:last-child{border-bottom:0}.conversation-contact[open]{background:rgba(167,139,250,.025)}.conversation-contact-summary{display:flex;align-items:center;gap:13px;padding:16px 20px;cursor:pointer;list-style:none}.conversation-contact-summary::-webkit-details-marker{display:none}.conversation-contact-summary:hover{background:rgba(167,139,250,.045)}.conversation-avatar{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border:1px solid var(--conversation-accent);border-radius:50%;background:rgba(167,139,250,.09);font-weight:800;color:var(--conversation-accent)}
        .conversation-contact-main{min-width:0;display:grid;gap:4px;flex:1}.conversation-contact-main strong{color:var(--foreground,#fff);font-size:.94rem}.conversation-contact-main>span,.conversation-contact-main>small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted,#a69bb7);font-size:.76rem}.conversation-contact-main>small{max-width:620px;font-size:.8rem}.conversation-contact-main i{font-style:normal}.conversation-contact-meta{display:grid;justify-items:end;gap:4px;flex:0 0 auto}.conversation-contact-meta em{font-size:.7rem;font-style:normal;text-transform:capitalize;color:#9c92ad}.conversation-contact-meta em.needs-attention{color:#fbbf24}.conversation-contact-meta small{font-size:.67rem;color:#8f83a4}.conversation-chevron{color:var(--conversation-accent);font-size:1.2rem;transition:transform .16s}.conversation-contact[open] .conversation-chevron{transform:rotate(180deg)}
        .conversation-expanded{padding:0 22px 22px 75px;display:grid;gap:16px}.conversation-summary-card{padding:14px 16px;border:1px solid rgba(167,139,250,.2);border-radius:12px;background:rgba(167,139,250,.055)}.conversation-summary-card p{margin:7px 0 0;color:#ddd6e7;line-height:1.6;white-space:pre-wrap}.conversation-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.conversation-detail-grid>div{display:grid;gap:4px;min-width:0}.conversation-detail-grid span{font-size:.7rem;color:#8f83a4;text-transform:uppercase;letter-spacing:.06em}.conversation-detail-grid strong{font-size:.82rem;font-weight:600;overflow-wrap:anywhere}.conversation-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.conversation-history-head h3{margin:0;font-size:.9rem}.conversation-history-head span{font-size:.72rem;color:#8f83a4}
        .conversation-thread{display:grid;gap:10px;max-height:520px;overflow:auto;padding:3px}.conversation-bubble{max-width:min(88%,720px);padding:11px 13px;border:1px solid rgba(167,139,250,.16);border-radius:13px;display:grid;gap:5px}.conversation-bubble.from-client{justify-self:start;background:rgba(255,255,255,.025)}.conversation-bubble.from-agent{justify-self:end;background:rgba(167,139,250,.08);border-color:var(--conversation-accent)}.conversation-bubble p{margin:0;color:#ddd6e7;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.conversation-bubble small,.conversation-role{font-size:.68rem;color:#8f83a4}.conversation-role{font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--conversation-accent)}.conversation-no-messages{margin:0;color:#a69bb7;font-size:.83rem;line-height:1.5}.conversation-actions{display:flex;gap:8px;flex-wrap:wrap}
        @media(max-width:700px){.conversation-inbox-head{padding:16px}.conversation-contact-summary{align-items:flex-start;padding:14px 12px;gap:10px}.conversation-avatar{width:36px;height:36px;flex-basis:36px}.conversation-contact-main>small{max-width:calc(100vw - 190px)}.conversation-contact-meta small{max-width:92px;text-align:right}.conversation-contact-meta em{max-width:95px;text-align:right}.conversation-expanded{padding:0 12px 18px}.conversation-detail-grid{grid-template-columns:1fr 1fr;gap:12px}.conversation-bubble{max-width:96%}}
      `}</style>
    </main>
  );
}
