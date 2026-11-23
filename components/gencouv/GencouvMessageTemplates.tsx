"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

type Message = { id: string; from_email: string; subject: string; text_body: string; updated_at?: string };
type Content = { from: string; subject: string; text: string };
type Library = { messages: Message[]; loading: boolean; saving: boolean; error: string; hasMore: boolean; reload: () => Promise<void>; more: () => Promise<void>; save: (content: Content) => Promise<void> };
const LibraryContext = createContext<Library | null>(null);
const endpoint = "/api/dashboard/gencouv/campaigns";
export function useGencouvMessageTemplates() {
  const library = useContext(LibraryContext);
  if (!library) throw new Error("Message templates require the Gencouv workspace.");
  return library;
}
export function GencouvMessageTemplatesProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const offset = useRef(0), saveLock = useRef(false), readVersion = useRef(0);
  const read = useCallback(async (append: boolean) => {
    const version = ++readVersion.current;
    setLoading(true); setError("");
    try {
      const response = await fetch(`${endpoint}?offset=${append ? offset.current : 0}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.campaigns)) throw new Error(data.error || "Saved message templates are unavailable. Refresh to retry.");
      if (version !== readVersion.current) return;
      setMessages(current => Array.from(new Map<string, Message>((append ? [...current, ...data.campaigns] : data.campaigns).map((item: Message) => [item.id, item] as const)).values()) as Message[]);
      setHasMore(data.has_more === true); offset.current = data.next_offset || 100;
    } catch (failure) {
      if (version === readVersion.current) setError(failure instanceof Error ? failure.message : "Saved message templates are unavailable. Refresh to retry.");
    } finally { if (version === readVersion.current) setLoading(false); }
  }, []);
  const reload = useCallback(() => read(false), [read]);
  const more = useCallback(() => read(true), [read]);
  useEffect(() => { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [reload]);
  const save = useCallback(async (content: Content) => {
    if (saveLock.current) throw new Error("Another template is being saved. Please wait.");
    saveLock.current = true; setSaving(true);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
      const data = await response.json();
      if (!response.ok || !data.campaign?.id) throw new Error(data.error || "Template save was not confirmed. Refresh the library before saving again.");
      await reload();
    } finally { saveLock.current = false; setSaving(false); }
  }, [reload]);
  return <LibraryContext.Provider value={{ messages, loading, saving, error, hasMore, reload, more, save }}>{children}</LibraryContext.Provider>;
}
export default function GencouvMessageTemplates({ label, content, disabled, onUse }: { label: string; content: Content; disabled: boolean; onUse: (message: Message) => void }) {
  const library = useGencouvMessageTemplates(), selectId = useId();
  const [selected, setSelected] = useState(""), [feedback, setFeedback] = useState(""), [error, setError] = useState("");
  async function save() {
    setFeedback(""); setError("");
    try { await library.save(content); setFeedback("Message template saved. No email was sent."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Template save was not confirmed. Refresh before saving again."); }
  }
  const saved = library.messages.find(message => message.id === selected);
  return <section className="gencouv-message-library" aria-label={label}>
    <h3>Saved message templates</h3>
    <p>Save the current sender, subject and message for reuse. The subject is its title. Loading replaces this composer’s message and starts a fresh review without recipients.</p>
    <label className="admin-field" htmlFor={selectId}>{label}<select id={selectId} disabled={disabled || library.loading} value={selected} onChange={event => { setSelected(event.target.value); setFeedback(""); }}>
      <option value="">Choose a saved message</option>{library.messages.map(message => <option key={message.id} value={message.id}>{message.subject}{message.updated_at ? ` · ${new Date(message.updated_at).toLocaleString()}` : ""}</option>)}
    </select></label>
    <div className="gencouv-action-row">
      <button type="button" disabled={disabled || library.saving || !content.subject.trim() || !content.text.trim()} onClick={() => void save()}>{library.saving ? "Saving template…" : "Save message as template"}</button>
      <button type="button" disabled={disabled || !saved || library.loading} onClick={() => { if (saved) { onUse(saved); setFeedback("Template loaded as a new message. Review recipients before sending."); setError(""); } }}>Load selected template</button>
      <button type="button" disabled={library.loading} onClick={() => void library.reload()}>Refresh saved templates</button>
      {library.hasMore ? <button type="button" disabled={library.loading} onClick={() => void library.more()}>Load more saved templates</button> : null}
    </div>
    {library.loading ? <p role="status">Loading saved message templates…</p> : null}
    {!library.loading && !library.error && !library.messages.length ? <p>No saved message templates yet. Write a subject and message, then save it here.</p> : null}
    {library.error || error ? <p role="alert">{error || library.error}</p> : null}
    {feedback ? <p role="status">{feedback}</p> : null}
  </section>;
}
