"use client";

import { useCallback, useEffect, useState } from "react";

type FailedEvent = {
  id: string;
  externalEventId: string;
  eventType: string;
  processedAt: string | null;
  processingError: string | null;
  createdAt: string;
  transactionReference: string | null;
  replayable: boolean;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function WebhookRecoveryPanel() {
  const [events, setEvents] = useState<FailedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/billing/webhook-recovery", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load failed webhook events.");
      setEvents(result.events || []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load failed webhook events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function retryManually(event: FailedEvent) {
    const confirmed = window.confirm(
      `Manually verify and replay this Flutterwave top-up event?\nReference: ${event.transactionReference || "unavailable"}\nThis action verifies the payment again before applying credits.`
    );
    if (!confirmed) return;

    setBusyId(event.id);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/billing/webhook-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Manual replay failed; review the recorded error.");
      setStatus(`Manual recovery succeeded for ${event.externalEventId}. Refreshing the failure list.`);
      await loadEvents();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Manual replay failed.");
      await loadEvents();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="admin-card">
      <h2>Failed payment webhooks</h2>
      <p className="admin-note">
        Failed events are never retried automatically. Only an administrator can trigger a manual replay. Replay is currently limited to verified Flux Credit top-ups; other event types require manual reconciliation.
      </p>
      {status ? <p role="status" className="admin-note">{status}</p> : null}
      {loading ? <p>Loading recorded failures…</p> : events.length ? (
        <div className="admin-list compact">
          {events.map((event) => (
            <div key={event.id}>
              <strong>{event.eventType} · {event.transactionReference || event.externalEventId}</strong>
              <span>Received {formatTimestamp(event.createdAt)} · {event.processingError || "No error detail"}</span>
              <span>Event ID: {event.id}</span>
              <button
                className="admin-button"
                type="button"
                disabled={busyId !== null || !event.replayable}
                onClick={() => void retryManually(event)}
              >
                {busyId === event.id ? "Verifying payment…" : event.replayable ? "Manually retry top-up" : "Manual reconciliation required"}
              </button>
            </div>
          ))}
        </div>
      ) : <p>No failed webhook events are currently recorded.</p>}
      <button className="admin-button secondary" type="button" onClick={() => void loadEvents()} disabled={loading || busyId !== null}>
        Refresh failure list
      </button>
    </section>
  );
}
