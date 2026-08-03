"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Check, Loader2 } from "lucide-react";

type CatalogOffering = {
  agent_key: string;
  display_name: string;
  setup_price: number;
  monthly_price: number;
  currency: string;
};

type Selection = {
  agent_key: string;
  status: string;
};

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function AgentAllocationControl({ organizationId }: { organizationId: string }) {
  const [catalog, setCatalog] = useState<CatalogOffering[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load allocations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !catalog.length) void load();
  }, [open]);

  function toggle(agentKey: string) {
    if (locked.includes(agentKey)) return;
    setSelected((current) => current.includes(agentKey) ? current.filter((key) => key !== agentKey) : [...current, agentKey]);
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
      setMessage("Agent allocation saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save allocations.");
    } finally {
      setSaving(false);
    }
  }

  const totals = useMemo(() => catalog
    .filter((item) => selected.includes(item.agent_key))
    .reduce((sum, item) => ({ setup: sum.setup + Number(item.setup_price), monthly: sum.monthly + Number(item.monthly_price) }), { setup: 0, monthly: 0 }), [catalog, selected]);

  return (
    <div style={{ minWidth: 260 }}>
      <button className="admin-button secondary" type="button" onClick={() => setOpen((value) => !value)}>
        <Bot size={15} /> {open ? "Close allocation" : "Allocate agents"}
      </button>
      {open ? (
        <div className="admin-panel compact" style={{ marginTop: 10 }}>
          {loading ? <p><Loader2 className="spin" size={15} /> Loading agent catalog...</p> : null}
          {!loading ? (
            <div className="admin-list">
              {catalog.map((item) => {
                const active = selected.includes(item.agent_key);
                const isLocked = locked.includes(item.agent_key);
                return (
                  <button
                    key={item.agent_key}
                    type="button"
                    className={`admin-list-row compact ${active ? "selected" : ""}`}
                    onClick={() => toggle(item.agent_key)}
                    disabled={isLocked}
                    style={{ width: "100%", textAlign: "left" }}
                  >
                    <span>{active ? <Check size={15} /> : <Bot size={15} />}</span>
                    <div style={{ flex: 1 }}><strong>{item.display_name}</strong><span>{money.format(Number(item.setup_price))} setup · {money.format(Number(item.monthly_price))}/month</span></div>
                    {isLocked ? <em>locked</em> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="admin-list-row compact"><div><strong>{selected.length} allocated</strong><span>{money.format(totals.setup)} setup · {money.format(totals.monthly)}/month</span></div><button className="admin-button" type="button" disabled={!selected.length || saving} onClick={save}>{saving ? "Saving..." : "Save allocation"}</button></div>
          {message ? <p className="admin-form-message">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
