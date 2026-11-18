"use client";

import { useCallback, useEffect, useState } from "react";

type RequestItem = { id: string; email: string; status: string; created_at: string };
type MemberItem = { id: string; user_id: string; email: string | null; status: string; role: string; created_at: string };
type TeamSummary = { planName: string; subscriptionStatus: string; maximumSeats: number; activeSeats: number; suspendedSeats: number; reservedInvitations: number; availableSeats: number };
type InvitationItem = { id: string; email: string; status: string; expires_at: string; created_at: string };

export default function AccessRequestsClient({
  accessCode,
  canManage,
}: {
  accessCode: string;
  canManage: boolean;
}) {
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [invitationPath, setInvitationPath] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [accessResponse, invitationResponse] = await Promise.all([
        fetch("/api/portal/team/access-requests", { cache: "no-store", signal }),
        canManage ? fetch("/api/organization/invitations", { cache: "no-store", signal }) : Promise.resolve(null),
      ]);
      const data = await accessResponse.json();
      if (signal?.aborted) return;
      if (!accessResponse.ok) throw new Error(data.error || "Unable to load team access.");
      if (!Array.isArray(data.members) || !data.summary) throw new Error("Team data is unavailable. Retry before changing access.");
      setSummary(data.summary);
      setRequests(data.requests || []);
      setMembers(data.members || []);
      if (invitationResponse) {
        const invitationsData = await invitationResponse.json();
        if (signal?.aborted) return;
        if (!invitationResponse.ok) throw new Error(invitationsData.error || "Unable to load invitations.");
        setInvitations(invitationsData.invitations || []);
      }
      setError("");
    } catch (cause) {
      if (signal?.aborted) return;
      setSummary(null);
      setError(cause instanceof Error ? cause.message : "Unable to load team access.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  async function act(payload: Record<string, string>, busyKey: string) {
    if (!canManage || busy) return;
    if (["remove", "suspend"].includes(payload.action) && !window.confirm(`${payload.action === "remove" ? "Remove" : "Suspend"} this manager’s workspace access? Their account and business records will be retained.`)) return;
    setError("");
    setNotice("");
    setBusy(busyKey);
    try {
      const response = await fetch("/api/portal/team/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update team access.");
      setNotice("Team access updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update team access.");
    } finally {
      setBusy("");
    }
  }

  async function invite() {
    if (!canManage || !email.trim() || busy || !summary || summary.availableSeats === 0) return;
    setBusy("invite");
    setError("");
    setNotice("");
    setInvitationPath("");
    try {
      const response = await fetch("/api/organization/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: "manager" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create invitation.");
      const path = data.invitation?.invitation_path;
      if (typeof path !== "string") throw new Error("Invitation created, but no shareable link was returned. Refresh your invitations.");
      setInvitationPath(window.location.origin + path);
      setNotice("Invitation created. Copy and share the link securely with your manager; it has not been emailed automatically.");
      setEmail("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to invite manager.");
    } finally {
      setBusy("");
    }
  }

  async function revoke(invitationId: string) {
    setBusy(invitationId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/organization/invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id: invitationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to revoke invitation.");
      setNotice("Invitation revoked.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to revoke invitation.");
    } finally {
      setBusy("");
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied to clipboard.");
      setError("");
    } catch {
      setError("Clipboard access failed. Select and copy the text manually.");
    }
  }

  const atLimit = summary !== null && summary.availableSeats === 0;
  const unavailable = loading || !summary;

  return <div className="portal-team-access-stack">
    {error ? <div role="alert" className="admin-error"><p>{error}</p><button type="button" className="portal-button secondary" disabled={!!busy || loading} onClick={() => void load()}>Retry team access</button></div> : null}
    {notice ? <p className="portal-form-message" role="status">{notice}</p> : null}
      <section className="portal-card">
        <div className="portal-card-head"><div>
          <p className="portal-kicker">Plan allowances</p>
          <h2>Team seats</h2>
          {summary ? <>
            <p>{summary.planName} · {summary.subscriptionStatus}</p>
            <dl className="portal-team-seat-summary">
              <div><dt>Maximum team seats</dt><dd>{summary.maximumSeats}</dd></div>
              <div><dt>Active seats</dt><dd>{summary.activeSeats}</dd></div>
              <div><dt>Suspended seats</dt><dd>{summary.suspendedSeats}</dd></div>
              <div><dt>Reserved invitations</dt><dd>{summary.reservedInvitations}</dd></div>
              <div><dt>Available seats</dt><dd>{summary.availableSeats}</dd></div>
            </dl>
            <p>The owner counts toward the total. Suspended memberships retain their seats; expired and revoked invitations do not.</p>
          </> : <p role="status">{loading ? "Loading team allowance…" : "Seat allowance unavailable. Retry to reload the current plan and roster."}</p>}
          {atLimit ? <p role="status">Seat limit reached. {canManage ? "Review billing or revoke a pending invitation before adding another manager." : "Ask your organization owner to review the plan."}</p> : null}
          {canManage && atLimit ? <a className="portal-button secondary" href="/portal/billing">Review plan</a> : null}
        </div></div>
      </section>
    {canManage ? <>
      <section className="portal-card">
        <div className="portal-card-head"><div>
          <p className="portal-kicker">Owner-only</p><h2>Invite a manager</h2>
          <p>Managers can operate your business dashboard, but cannot invite users, manage roles, or change billing. Invitations expire automatically.</p>
        </div></div>
        <form onSubmit={(event) => { event.preventDefault(); void invite(); }} className="portal-form-grid">
          <div className="portal-field">
            <label htmlFor="manager-invitation-email">Manager email</label>
            <input id="manager-invitation-email" type="email" autoComplete="email" placeholder="manager@example.com" required value={email} onChange={(event) => setEmail(event.target.value)}/>
          </div>
          <div className="portal-actions">
            <button className="portal-button" type="submit" disabled={!!busy || unavailable || atLimit}>{busy === "invite" ? "Creating..." : "Create manager invitation"}</button>
          </div>
        </form>
        {invitationPath ? <div className="portal-list-row" style={{ minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <strong>Secure invitation link</strong>
            <span style={{ overflowWrap: "anywhere" }}>{invitationPath}</span>
          </div>
          <button className="portal-button secondary" type="button" onClick={() => void copy(invitationPath)}>Copy link</button>
        </div> : null}
      </section>
      <section className="portal-card">
        <div className="portal-card-head">
          <div><p className="portal-kicker">Manager access</p><h2>Organization Access ID</h2><p>Share this ID with a manager. It does not grant access until the owner approves the request.</p></div>
          <div className="portal-actions" style={{ minWidth: 0, flexWrap: "wrap" }}>
            <strong style={{ overflowWrap: "anywhere" }}>{accessCode}</strong>
            <button className="portal-button secondary" type="button" onClick={() => void copy(accessCode)}>Copy Access ID</button>
          </div>
        </div>
      </section>
      <section className="portal-card">
        <div className="portal-card-head"><div><p className="portal-kicker">Pending</p><h2>Manager requests</h2><p>Approve or reject managers who requested access using the Access ID.</p></div></div>
        <div className="portal-list">
          {loading ? <p className="portal-empty">Loading...</p> : !summary ? <p>Data unavailable. Use Retry team access above.</p> : requests.length ? requests.map((item) => <div className="portal-list-row" key={item.id}>
            <div style={{ minWidth: 0 }}><strong style={{ overflowWrap: "anywhere" }}>{item.email}</strong><span>Requested {new Date(item.created_at).toLocaleString("en-NG")}</span></div>
            <div className="portal-actions">
              <button className="portal-button" type="button" disabled={!!busy || unavailable || (atLimit && !invitations.some((invitation) => invitation.email.toLowerCase() === item.email.toLowerCase()))} onClick={() => void act({ request_id: item.id, action: "approve" }, item.id)}>Approve</button>
              <button className="portal-button secondary" type="button" disabled={!!busy || loading} onClick={() => void act({ request_id: item.id, action: "reject" }, item.id)}>Reject</button>
            </div>
          </div>) : <p className="portal-empty">No pending manager requests.</p>}
        </div>
      </section>
      <section className="portal-card">
        <div className="portal-card-head"><div><p className="portal-kicker">Invitations</p><h2>Pending email invitations</h2></div></div>
        <div className="portal-list">
          {loading ? <p className="portal-empty">Loading...</p> : !summary ? <p>Data unavailable. Use Retry team access above.</p> : invitations.length ? invitations.map((item) => <div className="portal-list-row" key={item.id}>
            <div style={{ minWidth: 0 }}><strong style={{ overflowWrap: "anywhere" }}>{item.email}</strong><span>Expires {new Date(item.expires_at).toLocaleString("en-NG")}</span></div>
            <button className="portal-button secondary" type="button" disabled={!!busy || loading} onClick={() => void revoke(item.id)}>Revoke</button>
          </div>) : <p className="portal-empty">No pending invitations.</p>}
        </div>
      </section>
    </> : null}
    <section className="portal-card">
      <div className="portal-card-head"><div><p className="portal-kicker">Team</p><h2>Team members</h2><p>{canManage ? "Manage approved manager access." : "View authorized managers. Only your organization owner can change access."}</p></div></div>
      <div className="portal-list">
        {loading ? <p className="portal-empty">Loading team...</p> : !summary ? <p>Team data unavailable.</p> : members.length ? members.map((member) => <div className="portal-list-row" key={member.id}>
          <div style={{ minWidth: 0 }}><strong style={{ overflowWrap: "anywhere" }}>{member.email || member.user_id}</strong><span>{member.role} · {member.status} · joined {new Date(member.created_at).toLocaleDateString("en-NG")}</span></div>
          {canManage && member.role === "manager" ? <div className="portal-actions">
            {member.status === "active" ? <button className="portal-button secondary" type="button" disabled={!!busy} onClick={() => void act({ membership_id: member.id, action: "suspend" }, member.id)}>Suspend access</button> : null}
            {["suspended", "removed"].includes(member.status) ? <button className="portal-button secondary" type="button" disabled={!!busy || (member.status === "removed" && atLimit)} onClick={() => void act({ membership_id: member.id, action: "reactivate" }, member.id)}>Reactivate access</button> : null}
            {member.status !== "removed" ? <button className="portal-button secondary" type="button" disabled={!!busy} onClick={() => void act({ membership_id: member.id, action: "remove" }, member.id)}>Remove access</button> : null}
          </div> : null}
        </div>) : <p className="portal-empty">No team members found.</p>}
      </div>
    </section>
  </div>;
}
