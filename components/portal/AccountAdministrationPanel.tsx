"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  status: "active" | "suspended" | "archived";
  cancellationRequestedAt?: string;
  cancellationReason?: string;
  ownershipTransferTargetEmail?: string;
  isOwner: boolean;
};

export default function AccountAdministrationPanel(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState(props.cancellationReason || "");
  const [targetEmail, setTargetEmail] = useState(props.ownershipTransferTargetEmail || "");

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError("");
    try {
      const response = await fetch("/api/portal/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, confirm: true, ...extra }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Account action failed");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account action failed");
    } finally {
      setBusy(null);
    }
  }

  if (!props.isOwner) {
    return <div className="portal-list-row"><div><strong>Owner controls</strong><span>Only the workspace owner can change account lifecycle state or request ownership transfer.</span></div><em>restricted</em></div>;
  }

  return (
    <div className="portal-list" style={{ gap: 14 }}>
      {error ? <div className="portal-list-row"><div><strong>Action blocked</strong><span>{error}</span></div><em>error</em></div> : null}

      <div className="portal-list-row">
        <div><strong>Workspace state</strong><span>{props.status === "active" ? "Workspace operations are active." : "Workspace is suspended. Data is retained while operations are paused."}</span></div>
        {props.status === "active" ? (
          <button type="button" disabled={Boolean(busy)} onClick={() => run("suspend_workspace", { reason: "Owner paused workspace from account settings" })}>{busy === "suspend_workspace" ? "Pausing..." : "Pause workspace"}</button>
        ) : props.status === "suspended" ? (
          <button type="button" disabled={Boolean(busy)} onClick={() => run("reactivate_workspace", { reason: "Owner reactivated workspace from account settings" })}>{busy === "reactivate_workspace" ? "Reactivating..." : "Reactivate"}</button>
        ) : <em>archived</em>}
      </div>

      <div className="portal-list-row" style={{ alignItems: "start" }}>
        <div style={{ flex: 1 }}>
          <strong>Cancellation intent</strong>
          <span>{props.cancellationRequestedAt ? `Requested ${new Date(props.cancellationRequestedAt).toLocaleDateString()}. Nothing is deleted automatically.` : "Request cancellation for admin review without immediately deleting data or shutting down the workspace."}</span>
          {!props.cancellationRequestedAt ? <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional reason" rows={3} style={{ width: "100%", marginTop: 8 }} /> : null}
        </div>
        {props.cancellationRequestedAt ? (
          <button type="button" disabled={Boolean(busy)} onClick={() => run("revoke_cancellation")}>{busy === "revoke_cancellation" ? "Keeping..." : "Keep account"}</button>
        ) : (
          <button type="button" disabled={Boolean(busy)} onClick={() => run("request_cancellation", { reason })}>{busy === "request_cancellation" ? "Requesting..." : "Request cancellation"}</button>
        )}
      </div>

      <div className="portal-list-row" style={{ alignItems: "start" }}>
        <div style={{ flex: 1 }}>
          <strong>Ownership transfer</strong>
          <span>A transfer request is recorded for controlled admin review. Ownership is never silently reassigned from a browser request.</span>
          <input type="email" value={targetEmail} onChange={(event) => setTargetEmail(event.target.value)} placeholder="new-owner@company.com" style={{ width: "100%", marginTop: 8 }} />
        </div>
        <button type="button" disabled={Boolean(busy) || !targetEmail} onClick={() => run("request_ownership_transfer", { targetEmail })}>{busy === "request_ownership_transfer" ? "Requesting..." : "Request transfer"}</button>
      </div>
    </div>
  );
}
