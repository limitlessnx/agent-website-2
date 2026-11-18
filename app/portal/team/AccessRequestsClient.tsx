"use client";

import { useCallback, useEffect, useState } from "react";

type RequestItem = { id: string; email: string; status: string; created_at: string };
type MemberItem = { id: string; user_id: string; email: string | null; status: string; role: string; created_at: string };
type InvitationItem = { id: string; email: string; status: string; expires_at: string; created_at: string };

export default function AccessRequestsClient({
  accessCode,
  canManage,
  seatLimit,
}: {
  accessCode: string;
  canManage: boolean;
  seatLimit: number | null;
}) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [invitationPath, setInvitationPath] = useState("");

  const load = useCallback(async () => {
    try {
      const [accessResponse, invitationResponse] = await Promise.all([
        fetch("/api/portal/team/access-requests", { cache: "no-store" }),
        canManage ? fetch("/api/organization/invitations", { cache: "no-store" }) : Promise.resolve(null),
      ]);
      const data = await accessResponse.json();
      if (!accessResponse.ok) throw new Error(data.error || "Unable to load team access.");
      setRequests(data.requests || []);
      setMembers(data.members || []);
      if (invitationResponse) {
        const invitationsData = await invitationResponse.json();
        if (!invitationResponse.ok) throw new Error(invitationsData.error || "Unable to load invitations.");
        setInvitations(invitationsData.invitations || []);
      }
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load team access.");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { void load(); }, [load]);

  async function act(payload: Record<string, string>, busyKey: string) {
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
    if (!canManage || !email.trim()) return;
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

  const activeManagers = members.filter((member) => member.role === "manager" && member.status === "active");
  const occupiedSeats = members.filter((member) => ["active", "suspended"].includes(member.status)).length + invitations.length;
  const atLimit = seatLimit !== null && occupiedSeats >= seatLimit;

  return <div className="portal-team-access-stack">
    {canManage ? <>
      <section className="portal-card">
        <div className="portal-card-head"><div>
          <p className="portal-kicker">Plan allowances</p>
          <h2>Team seats</h2>
          <p>{seatLimit === null ? "Seat allowance temporarily unavailable. The server will still enforce your plan." : `${occupiedSeats} of ${seatLimit} seats in use (including pending invitations).`}</p>
          {atLimit ? <p role="status">Seat limit reached. Upgrade your plan or remove an existing invitation before adding another manager.</p> : null}
        </div></div>
      </section>
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
            <button className="portal-button" type="submit" disabled={busy === "invite" || atLimit}>{busy === "invite" ? "Creating..." : "Create manager invitation"}</button>
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
          {loading ? <p className="portal-empty">Loading...</p> : requests.length ? requests.map((item) => <div className="portal-list-row" key={item.id}>
            <div style={{ minWidth: 0 }}><strong style={{ overflowWrap: "anywhere" }}>{item.email}</strong><span>Requested {new Date(item.created_at).toLocaleString("en-NG")}</span></div>
            <div className="portal-actions">
              <button className="portal-button" type="button" disabled={!!busy || atLimit} onClick={() => void act({ request_id: item.id, action: "approve" }, item.id)}>Approve</button>
              <button className="portal-button secondary" type="button" disabled={!!busy} onClick={() => void act({ request_id: item.id, action: "reject" }, item.id)}>Reject</button>
            </div>
          </div>) : <p className="portal-empty">No pending manager requests.</p>}
        </div>
      </section>
      <section className="portal-card">
        <div className="portal-card-head"><div><p className="portal-kicker">Invitations</p><h2>Pending email invitations</h2></div></div>
        <div className="portal-list">
          {loading ? <p className="portal-empty">Loading...</p> : invitations.length ? invitations.map((item) => <div className="portal-list-row" key={item.id}>
            <div style={{ minWidth: 0 }}><strong style={{ overflowWrap: "anywhere" }}>{item.email}</strong><span>Expires {new Date(item.expires_at).toLocaleString("en-NG")}</span></div>
            <button className="portal-button secondary" type="button" disabled={!!busy} onClick={() => void revoke(item.id)}>Revoke</button>
          </div>) : <p className="portal-empty">No pending invitations.</p>}
        </div>
      </section>
    </> : null}
    <section className="portal-card">
      <div className="portal-card-head"><div><p className="portal-kicker">Team</p><h2>Active managers</h2><p>{canManage ? "Manage approved manager access." : "View authorized managers. Only your organization owner can change access."}</p></div></div>
      <div className="portal-list">
        {loading ? <p className="portal-empty">Loading team...</p> : activeManagers.length ? activeManagers.map((member) => <div className="portal-list-row" key={member.id}>
          <div style={{ minWidth: 0 }}><strong style={{ overflowWrap: "anywhere" }}>{member.email || member.user_id}</strong><span>Manager · active · joined {new Date(member.created_at).toLocaleDateString("en-NG")}</span></div>
          {canManage ? <button className="portal-button secondary" type="button" disabled={!!busy} onClick={() => void act({ membership_id: member.id, action: "remove" }, member.id)}>Remove access</button> : null}
        </div>) : <p className="portal-empty">No active managers yet.</p>}
      </div>
    </section>
    {notice ? <p className="portal-form-message" role="status">{notice}</p> : null}
    {error ? <p className="admin-error" role="alert">{error}</p> : null}
  </div>;
}
