"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { executeLeoClientTool, leoExecutionMessage, leoExecutionPending, type LeoClientApprovals } from "@/lib/leo-tool-client";

export type LeoMessage = { role: "user" | "assistant"; content: string; source?: "chat" | "voice" };
export type LeoToolCall = {
  toolKey: string;
  reason: string;
  approval: "none" | "admin" | "confirm";
  arguments: Record<string, unknown>;
  status: "proposed" | "executing" | "queued" | "executed" | "failed" | "dismissed";
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
    const status: LeoToolCall["status"] = ["executing", "queued", "executed", "failed", "dismissed"].includes(rawStatus) ? rawStatus as LeoToolCall["status"] : "proposed";
    return [{ toolKey, reason: String(row.reason || "Leo prepared an operational action."), approval, arguments: row.arguments && typeof row.arguments === "object" && !Array.isArray(row.arguments) ? row.arguments as Record<string, unknown> : {}, status, result: row.result }];
  }).slice(-8);
}

function executionSummary(tool: LeoToolCall, result: Record<string, unknown>) {
  if (result.provider === "trigger_dev") return leoExecutionMessage(result);
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

export function LeoConversationProvider({ children, tenantScope }: { children: React.ReactNode; tenantScope?: string }) {
  const scopeSuffix = tenantScope ? `:${tenantScope}` : "";
  const tenantSurface = Boolean(tenantScope);
  const [storageReady, setStorageReady] = useState(false);
  const [sessionIdState, setSessionIdState] = useState("");
  const [messages, setMessages] = useState<LeoMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<LeoToolCall[]>([]);
  const [busy, setBusy] = useState(false);
  const [executingTool, setExecutingTool] = useState("");
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const approvals = useRef<LeoClientApprovals>(new Map());

  useEffect(() => {
    const pending = toolCalls.filter(tool => tool.status === "queued");
    if (!pending.length) return;
    const controller = new AbortController();
    let polling = false;
    const timer = setInterval(() => {
      if (polling) return;
      polling = true;
      void Promise.all(pending.map(async tool => {
        const prior = tool.result as Record<string, unknown>;
        if (!prior?.executionId) return;
        try {
          const response = await fetch(`/api/leo/executions/${encodeURIComponent(String(prior.executionId))}`, { cache: "no-store", signal: controller.signal, headers: tenantSurface ? { "x-leo-surface": "tenant" } : undefined });
          if (!response.ok) return;
          const result = await response.json() as Record<string, unknown>;
          if (controller.signal.aborted) return;
          if (leoExecutionPending(result)) return;
          setToolCalls(current => current.map(item => item.toolKey === tool.toolKey && item.status === "queued" ? { ...item, status: result.status === "completed" ? "executed" : "failed", result } : item));
          setMessages(current => [...current, { role: "assistant", content: leoExecutionMessage(result), source: "chat" } as LeoMessage].slice(-40));
          setCompleted(result.status === "completed");
        } catch { /* Keep the last known queued state until polling can resume. */ }
      })).finally(() => { polling = false; });
    }, 3000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [toolCalls, tenantSurface]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        setSessionIdState(sessionStorage.getItem(SESSION_KEY + scopeSuffix) || "");
        setMessages(safeStoredMessages(sessionStorage.getItem(MESSAGES_KEY + scopeSuffix)));
        setToolCalls(normalizeTools(JSON.parse(sessionStorage.getItem(TOOLS_KEY + scopeSuffix) || "[]")));
      } catch {}
      setStorageReady(true);
    });
    return () => { cancelled = true; };
  }, [scopeSuffix]);

  useEffect(() => { if (!storageReady) return; try { sessionStorage.setItem(MESSAGES_KEY + scopeSuffix, JSON.stringify(messages.slice(-40))); } catch {} }, [messages, scopeSuffix, storageReady]);
  useEffect(() => { if (!storageReady) return; try { sessionStorage.setItem(TOOLS_KEY + scopeSuffix, JSON.stringify(toolCalls.slice(-8))); } catch {} }, [toolCalls, scopeSuffix, storageReady]);

  const setSessionId = useCallback((sessionId: string) => {
    const clean = String(sessionId || "").trim();
    if (!clean) return;
    setSessionIdState(clean);
    try { sessionStorage.setItem(SESSION_KEY + scopeSuffix, clean); } catch {}
  }, [scopeSuffix]);

  const appendTranscript = useCallback((message: { role: "user" | "assistant"; content: string }) => {
    const content = String(message.content || "").trim();
    if (!content) return;
    setMessages((current) => {
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
        headers: { "Content-Type": "application/json", ...(tenantSurface ? { "x-leo-surface": "tenant" } : {}) },
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
  }, [busy, executingTool, sessionIdState, setSessionId, tenantSurface]);

  const executeTool = useCallback(async (tool: LeoToolCall) => {
    if (busy || executingTool || tool.status !== "proposed") return;
    setExecutingTool(tool.toolKey);
    setCompleted(false);
    setError("");
    setToolCalls((current) => current.map((item) => item.toolKey === tool.toolKey ? { ...item, status: "executing" } : item));
    try {
      const { response, result } = await executeLeoClientTool({ toolKey: tool.toolKey, arguments: tool.arguments, sessionId: sessionIdState || undefined, channel: "chat", tenantSurface, confirmed: tool.approval === "confirm" }, approvals.current);
      if (result.status === "confirmation_required") {
        setToolCalls((current) => current.map((item) => item.toolKey === tool.toolKey ? { ...item, status: "proposed", result } : item));
        return;
      }
      const queued = Boolean(result.executionId) && leoExecutionPending(result);
      if ((!response.ok || result.ok === false) && !queued) throw new Error(String(result.error || result.message || "Leo could not execute this action."));
      setToolCalls((current) => current.map((item) => item.toolKey === tool.toolKey ? { ...item, status: queued ? "queued" : "executed", result } : item));
      const summary = executionSummary(tool, result);
      setMessages((current) => [...current, { role: "assistant", content: summary, source: "chat" } as LeoMessage].slice(-40));
      setCompleted(!queued);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Leo could not execute this action.";
      setError(message);
      setToolCalls((current) => current.map((item) => item.toolKey === tool.toolKey ? { ...item, status: "failed", result: { error: message } } : item));
    } finally {
      setExecutingTool("");
    }
  }, [busy, executingTool, sessionIdState, tenantSurface]);

  const dismissTool = useCallback((toolKey: string) => {
    setToolCalls((current) => current.map((item) => item.toolKey === toolKey && item.status === "proposed" ? { ...item, status: "dismissed" } : item));
  }, []);

  const hasApproval = toolCalls.some((tool) => tool.status === "proposed" && tool.approval === "confirm");
  const operationState: LeoOperationState = error ? "error" : executingTool || toolCalls.some(tool => tool.status === "queued") ? "executing" : busy ? "investigating" : completed ? "completed" : hasApproval ? "approval_required" : "ready";

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
