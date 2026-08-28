"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type LeoMessage = { role: "user" | "assistant"; content: string; source?: "chat" | "voice" };
export type LeoToolCall = {
  toolKey: string;
  reason: string;
  approval: "none" | "admin" | "confirm";
  arguments: Record<string, unknown>;
  status: "proposed" | "executing" | "executed" | "failed" | "dismissed";
  result?: unknown;
};
export type LeoOperationState = "ready" | "investigating" | "approval_required" | "executing" | "completed" | "error";
type PageContext = Record<string, unknown> | undefined;

type LeoConversationValue = {
  sessionId: string;
  messages: LeoMessage[];
  toolCalls: LeoToolCall[];
  busy: boolean;
  error: string;
  operationState: LeoOperationState;
  sendMessage: (message: string, pageContext?: PageContext) => Promise<void>;
  executeTool: (tool: LeoToolCall) => Promise<void>;
  dismissTool: (toolKey: string) => void;
  setSessionId: (sessionId: string) => void;
  appendTranscript: (message: { role: "user" | "assistant"; content: string }) => void;
  clearError: () => void;
};

const SESSION_KEY = "fluxknight.leo.session";
const MESSAGES_KEY = "fluxknight.leo.messages";
const TOOLS_KEY = "fluxknight.leo.tools";
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

function normalizeTools(value: unknown): LeoToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): LeoToolCall[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const toolKey = String(row.toolKey || "").trim();
    if (!toolKey) return [];
    const approval: LeoToolCall["approval"] = row.approval === "confirm" ? "confirm" : row.approval === "admin" ? "admin" : "none";
    const rawStatus = String(row.status || "proposed");
    const status: LeoToolCall["status"] = ["executing", "executed", "failed", "dismissed"].includes(rawStatus) ? rawStatus as LeoToolCall["status"] : "proposed";
    return [{ toolKey, reason: String(row.reason || "Leo prepared an operational action."), approval, arguments: row.arguments && typeof row.arguments === "object" && !Array.isArray(row.arguments) ? row.arguments as Record<string, unknown> : {}, status, result: row.result }];
  }).slice(-8);
}

function executionSummary(tool: LeoToolCall, result: Record<string, unknown>) {
  const title = tool.toolKey.split(".").slice(-2).join(" ").replaceAll("_", " ");
  if (result.ok === false) return `Action failed: ${String(result.error || result.message || title)}.`;
  if (result.status === "confirmation_required") return String(result.message || "Approval is required before Leo can execute this action.");
  const nested = result.result && typeof result.result === "object" ? result.result as Record<string, unknown> : result;
  const delivered = Number(nested.delivered || 0);
  const read = Number(nested.read || 0);
  const failed = Number(nested.failed || 0);
  const unresolved = Number(nested.pendingDelivery ?? nested.pending_delivery ?? 0);
  const accepted = Number(nested.accepted ?? nested.sent ?? 0);
  if (delivered || read || failed || unresolved || accepted) return `Executed: ${title || "the requested action"}. Accepted ${accepted}, delivered ${delivered}, read ${read}, failed ${failed}, unresolved ${unresolved}.`;
  return `Executed: ${title || "the requested action"}. The execution completed successfully; external delivery or post-condition verification may still be pending.`;
}

export function LeoConversationProvider({ children }: { children: React.ReactNode }) {
  const [sessionIdState, setSessionIdState] = useState("");
  const [messages, setMessages] = useState<LeoMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<LeoToolCall[]>([]);
  const [busy, setBusy] = useState(false);
  const [executingTool, setExecutingTool] = useState("");
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    try {
      setSessionIdState(sessionStorage.getItem(SESSION_KEY) || "");
      setMessages(safeStoredMessages(sessionStorage.getItem(MESSAGES_KEY)));
      setToolCalls(normalizeTools(JSON.parse(sessionStorage.getItem(TOOLS_KEY) || "[]")));
    } catch {}
  }, []);

  useEffect(() => { try { sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-40))); } catch {} }, [messages]);
  useEffect(() => { try { sessionStorage.setItem(TOOLS_KEY, JSON.stringify(toolCalls.slice(-8))); } catch {} }, [toolCalls]);

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
    if (!clean || busy || executingTool) return;
    setBusy(true);
    setCompleted(false);
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
      setToolCalls(normalizeTools(result.toolCalls));
      const assistantMessage: LeoMessage = { role: "assistant", content: String(result.reply || "Leo returned no response."), source: "chat" };
      setMessages((current) => [...current, assistantMessage].slice(-40));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Leo could not respond.");
    } finally {
      setBusy(false);
    }
  }, [busy, executingTool, sessionIdState, setSessionId]);

  const executeTool = useCallback(async (tool: LeoToolCall) => {
    if (busy || executingTool || tool.status !== "proposed") return;
    setExecutingTool(tool.toolKey);
    setCompleted(false);
    setError("");
    setToolCalls((current) => current.map((item) => item.toolKey === tool.toolKey ? { ...item, status: "executing" } : item));
    try {
      const response = await fetch("/api/leo/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolKey: tool.toolKey, arguments: tool.arguments, sessionId: sessionIdState || undefined, channel: "chat", confirmed: tool.approval === "confirm" }),
      });
      const result = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok || result.ok === false) throw new Error(String(result.error || result.message || "Leo could not execute this action."));
      if (result.status === "confirmation_required") {
        setToolCalls((current) => current.map((item) => item.toolKey === tool.toolKey ? { ...item, status: "proposed", result } : item));
        return;
      }
      setToolCalls((current) => current.map((item) => item.toolKey === tool.toolKey ? { ...item, status: "executed", result } : item));
      const summary = executionSummary(tool, result);
      setMessages((current) => [...current, { role: "assistant", content: summary, source: "chat" } as LeoMessage].slice(-40));
      setCompleted(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Leo could not execute this action.";
      setError(message);
      setToolCalls((current) => current.map((item) => item.toolKey === tool.toolKey ? { ...item, status: "failed", result: { error: message } } : item));
    } finally {
      setExecutingTool("");
    }
  }, [busy, executingTool, sessionIdState]);

  const dismissTool = useCallback((toolKey: string) => {
    setToolCalls((current) => current.map((item) => item.toolKey === toolKey && item.status === "proposed" ? { ...item, status: "dismissed" } : item));
  }, []);

  const hasApproval = toolCalls.some((tool) => tool.status === "proposed" && tool.approval === "confirm");
  const operationState: LeoOperationState = error ? "error" : executingTool ? "executing" : busy ? "investigating" : completed ? "completed" : hasApproval ? "approval_required" : "ready";

  const value = useMemo<LeoConversationValue>(() => ({
    sessionId: sessionIdState,
    messages,
    toolCalls,
    busy: busy || Boolean(executingTool),
    error,
    operationState,
    sendMessage,
    executeTool,
    dismissTool,
    setSessionId,
    appendTranscript,
    clearError: () => setError(""),
  }), [sessionIdState, messages, toolCalls, busy, executingTool, error, operationState, sendMessage, executeTool, dismissTool, setSessionId, appendTranscript]);

  return <LeoConversationContext.Provider value={value}>{children}</LeoConversationContext.Provider>;
}

export function useLeoConversation() {
  const context = useContext(LeoConversationContext);
  if (!context) throw new Error("useLeoConversation must be used inside LeoConversationProvider.");
  return context;
}
