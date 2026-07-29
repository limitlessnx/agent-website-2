"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, PlugZap, Trash2 } from "lucide-react";

const providerFields: Record<string, Array<{ key: string; label: string; type?: string }>> = {
  openai: [{ key: "api_key", label: "OpenAI API key", type: "password" }],
  whatsapp: [
    { key: "access_token", label: "Access token", type: "password" },
    { key: "phone_number_id", label: "Phone number ID" },
    { key: "business_account_id", label: "Business account ID" },
  ],
  n8n: [
    { key: "base_url", label: "Automation engine base URL" },
    { key: "api_key", label: "Automation engine API key", type: "password" },
  ],
  elevenlabs: [{ key: "api_key", label: "ElevenLabs API key", type: "password" }],
  supabase: [
    { key: "project_url", label: "Supabase project URL" },
    { key: "service_role_key", label: "Service role key", type: "password" },
  ],
  email: [
    { key: "api_key", label: "Email provider API key", type: "password" },
    { key: "from_email", label: "From email" },
  ],
  google_calendar: [{ key: "service_account_json", label: "Service account JSON", type: "password" }],
  google_sheets: [{ key: "service_account_json", label: "Service account JSON", type: "password" }],
};

type Props = {
  integration: {
    id: string;
    provider: string;
    status: string;
    has_credentials: boolean;
    secret_keys: string[];
  };
};

export default function IntegrationCredentialControl({ integration }: Props) {
  const router = useRouter();
  const fields = useMemo(
    () => providerFields[integration.provider] || [{ key: "api_key", label: "API key", type: "password" }],
    [integration.provider],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/integrations/${integration.id}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials: values, configuration: {} }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save credentials.");
      setValues({});
      setOpen(false);
      setMessage("Credentials saved securely.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save credentials.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Remove the stored credentials and disconnect this integration?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/integrations/${integration.id}/credentials`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to disconnect integration.");
      setMessage("Integration disconnected.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disconnect integration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minWidth: 320 }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button className="admin-button secondary" type="button" onClick={() => setOpen((value) => !value)} disabled={busy}>
          <KeyRound size={14} /> {integration.has_credentials ? "Rotate credentials" : "Configure"}
        </button>
        {integration.has_credentials ? (
          <button className="admin-button secondary" type="button" onClick={disconnect} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Disconnect
          </button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={save} style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {fields.map((field) => (
            <label key={field.key} style={{ display: "grid", gap: 5 }}>
              <span className="muted">{field.label}</span>
              <input
                className="admin-input"
                type={field.type || "text"}
                value={values[field.key] || ""}
                placeholder={integration.has_credentials ? "Enter replacement value" : field.label}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                autoComplete="off"
              />
            </label>
          ))}
          <button className="admin-button" type="submit" disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <PlugZap size={14} />} Save securely
          </button>
        </form>
      ) : null}

      {integration.has_credentials && integration.secret_keys.length ? (
        <small className="muted">Stored fields: {integration.secret_keys.join(", ").replaceAll("_", " ")}</small>
      ) : null}
      {message ? <small className="muted">{message}</small> : null}
    </div>
  );
}
