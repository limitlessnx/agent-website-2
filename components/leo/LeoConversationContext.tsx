"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type LeoMessage = { role: "user" | "assistant"; content: string; source?: "chat" | "voice" };
type LeoOperationState = "ready" | "investigating" | "error";
type PageContext = Record<string, unknown> | undefined;

type LeoConversationValue = {
  sessionId: string;
  messages: LeoMessage[];
  busy: boolean;
  error: string;
  operationState: LeoOperationState;
  sendMessage: (message: string, pageContext?: PageContext) => Promise<void>;
  setSessionId: (sessionId: string) => void;
  appendTranscript: (message: { role: "user" | "assistant"; content: string }) => void;
  clearError: () => void;
};

const SESSION_KEY = "fluxknight.leo.session";
const MESSAGES_KEY = "fluxknight.leo.messages";
const LeoConversationContext = createContext<LeoConversationValue | null>(null);

function safeStoredMessages(value: string | null): LeoMessage[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object" && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .map((item): LeoMessage => ({ role: item.role as "user" | "assistant", content: item.content.slice(0, 8000), source: item.source === "voice" ? "voice" : "chat" }))
      .slice(-40);
  } catch { return []; }
}

export function LeoConversationProvider({ children }: { children: React.ReactNode }) {
  const [sessionIdState, setSessionIdState] = useState("");
  const [messages, setMessages] = useState<LeoMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      setSessionIdState(sessionStorage.getItem(SESSION_KEY) || "");
      setMessages(safeStoredMessages(sessionStorage.getItem(MESSAGES_KEY)));
    } catch {}
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-40))); } catch {}
  }, [messages]);

  const setSessionId = useCallback((sessionId: string) => {
    const clean = String(sessionId || "").trim();
    if (!clean) return;
    setSessionIdState(clean);
    try { sessionStorage.setItem(SESSION_KEY, clean); } catch {}
  }, []);

  const appendTranscript = useCallback((message: { role: "user" | "assistant"; content: string }) => {
    const content = String(message.content || "").trim();
    if (!content) return;
    setMessages((current) => {
      const previous = current[current.length - 1];
      if (previous?.role === message.role && previous.content === content) return current;
      const next: LeoMessage = { role: message.role, content, source: "voice" };
      return [...current, next].slice(-40);
    });
  }, []);

  const sendMessage = useCallback(async (message: string, pageContext?: PageContext) => {
    const clean = String(message || "").trim();
    if (!clean || busy) return;
    setBusy(true);
    setError("");
    const userMessage: LeoMessage = { role: "user", content: clean, source: "chat" };
    setMessages((current) => [...current, userMessage].slice(-40));
    try {
      const response = await fetch("/api/leo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, sessionId: sessionIdState || undefined, pageContext, channel: "chat" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Leo could not respond.");
      if (result.sessionId) setSessionId(result.sessionId);
      const assistantMessage: LeoMessage = { role: "assistant", content: String(result.reply || "Leo returned no response."), source: "chat" };
      setMessages((current) => [...current, assistantMessage].slice(-40));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Leo could not respond.");
    } finally {
      setBusy(false);
    }
  }, [busy, sessionIdState, setSessionId]);

  const value = useMemo<LeoConversationValue>(() => ({
    sessionId: sessionIdState,
    messages,
    busy,
    error,
    operationState: error ? "error" : busy ? "investigating" : "ready",
    sendMessage,
    setSessionId,
    appendTranscript,
    clearError: () => setError(""),
  }), [sessionIdState, messages, busy, error, sendMessage, setSessionId, appendTranscript]);

  return <LeoConversationContext.Provider value={value}>{children}</LeoConversationContext.Provider>;
}

export function useLeoConversation() {
  const context = useContext(LeoConversationContext);
  if (!context) throw new Error("useLeoConversation must be used inside LeoConversationProvider.");
  return context;
}
