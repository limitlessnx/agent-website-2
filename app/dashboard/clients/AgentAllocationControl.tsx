"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Loader2 } from "lucide-react";

type CatalogOffering = {
  agent_key: string;
  display_name: string;
  metadata?: {
    summary?: string;
    capabilities?: string[];
    system_slug?: string;
  };
};

type Selection = {
  agent_key: string;
  status: string;
};

type AllocationContext = {
  packageName: string | null;
  packageSlug: string | null;
  maxAgents: number | null;
  unlimited: boolean;
};

export default function AgentAllocationControl({
  organizationId,
  embedded = false,
}: {
  organizationId: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogOffering[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [allocationContext, setAllocationContext] = useState<AllocationContext>({ packageName: null, packageSlug: null, maxAgents: null, unlimited: false });
  const [open, setOpen] = useState(embedded);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/agent-allocations?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load allocations.");
      const selections = (result.selections || []) as Selection[];
      setCatalog(result.catalog || []);
      setSelected(selections.map((item) => item.agent_key));
      setLocked(selections.filter((item) => ["paid", "provisioning", "active"].includes(item.status)).map((item) => item.agent_key));
      setAllocationContext(result.allocationContext || { packageName: null, packageSlug: null, maxAgents: null, unlimited: false });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load allocations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !catalog.length) void load();
  }, [open, catalog.length]);

  function toggle(agentKey: string) {
    if (locked.includes(agentKey)) return;
    setMessage("");
    setSelected((current) => {
      if (current.includes(agentKey)) return current.filter((key) => key !== agentKey);
      const limit = allocationContext.unlimited ? null : allocationContext.maxAgents;
      if (limit !== null && current.length >= limit) {
        setMessage(`${allocationContext.packageName || "This plan"} allows ${limit} agent${limit === 1 ? "" : "s"}. Remove one before selecting another.`);
        return current;
      }
      return [...current, agentKey];
    });
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/agent-allocations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, agentKeys: selected }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save allocations.");
      const selections = (result.selections || []) as Selection[];
      setSelected(selections.map((item) => item.agent_key));
      setLocked(selections.filter((item) => ["paid", "provisioning", "active"].includes(item.status)).map((item) => item.agent_key));
      setAllocationContext(result.allocationContext || allocationContext);
      const created = Number(result.provisioning?.agents_created || 0);
      const reused = Number(result.provisioning?.agents_reused || 0);
      setMessage(`Allocation saved and tenant agent provisioning prepared${created || reused ? ` (${created} created, ${reused} reused)` : ""}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save allocations.");
    } finally {
      setSaving(false);
    }
  }

  const limitLabel = allocationContext.unlimited
    ? "Unlimited/custom allocation"
    : allocationContext.maxAgents !== null
      ? `${allocationContext.maxAgents} agent${allocationContext.maxAgents === 1 ? "" : "s"}`
      : "Allocation limit not configured";

  return (
    <div style={{ width: "100%" }}>
      {!embedded ? (
        <button className="admin-button secondary" type="button" onClick={() => setOpen((value) => !value)}>
          <Bot size={15} /> {open ? "Close allocation" : "Allocate agents"}
        </button>
      ) : null}
      {open ? (
        <div className={embedded ? "" : "admin-panel compact"} style={embedded ? undefined : { marginTop: 10 }}>
          {loading ? <p><Loader2 className="spin" size={15} /> Loading marketplace agents...</p> : null}
          {!loading ? (
            <>
              <div className="admin-list-row compact" style={{ marginBottom: 12 }}>
                <div>
                  <strong>{allocationContext.packageName || "Plan not linked"}</strong>
                  <span>{limitLabel} · choose from the six core marketplace agents</span>
                </div>
                <em>{selected.length}{allocationContext.unlimited || allocationContext.maxAgents === null ? "" : `/${allocationContext.maxAgents}`} selected</em>
              </div>
              <div className="admin-list">
                {catalog.map((item) => {
                  const active = selected.includes(item.agent_key);
                  const isLocked = locked.includes(item.agent_key);
                  const capabilities = Array.isArray(item.metadata?.capabilities) ? item.metadata?.capabilities : [];
                  return (
                    <button
                      key={item.agent_key}
                      type="button"
                      className={`admin-list-row ${active ? "selected" : ""}`}
                      onClick={() => toggle(item.agent_key)}
                      disabled={isLocked}
                      style={{ width: "100%", textAlign: "left", alignItems: "flex-start" }}
                    >
                      <span>{active ? <Check size={15} /> : <Bot size={15} />}</span>
                      <div style={{ flex: 1 }}>
                        <strong>{item.display_name}</strong>
                        <span>{item.metadata?.summary || "Reusable Fluxknight marketplace agent for this tenant."}</span>
                        {capabilities.length ? <span>{capabilities.slice(0, 4).join(" · ")}</span> : null}
                      </div>
                      {isLocked ? <em>provisioned</em> : active ? <em>selected</em> : null}
                    </button>
                  );
                })}
                {!catalog.length ? <p className="admin-empty">No core marketplace agents are currently available.</p> : null}
              </div>
            </>
          ) : null}
          <div className="admin-list-row compact" style={{ marginTop: 12 }}>
            <div><strong>{selected.length} allocated</strong><span>Agent pricing is controlled by the client plan, not by individual marketplace agent cards.</span></div>
            <button className="admin-button" type="button" disabled={!selected.length || saving} onClick={save}>{saving ? "Provisioning..." : "Save & provision"}</button>
          </div>
          {message ? <p className="admin-form-message">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
