"use client";

import { useActionState, type ReactNode } from "react";

export type ActionResult = { ok: boolean; message: string };
type FormAction = (previous: ActionResult, data: FormData) => Promise<ActionResult>;

export default function ActionForm({ action, children, label = "Save", confirmMessage }: {
  action: FormAction; children: ReactNode; label?: string; confirmMessage?: string;
}) {
  const [state, submit, pending] = useActionState(action, { ok: false, message: "" });
  const busyLabel = label === "Delete property" ? "Deleting…" : /media|upload/i.test(label) ? "Uploading…" : "Saving…";
  return (
    <form action={submit} className="admin-form-grid compact" aria-busy={pending}
      onSubmit={(event) => { if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault(); }}>
      {children}
      <button disabled={pending} type="submit" aria-live="polite">
        {pending ? <><span className="action-loading-spinner" aria-hidden="true" />{busyLabel}</> : label}
      </button>
      {state.message ? <p role={state.ok ? "status" : "alert"} aria-live={state.ok ? "polite" : "assertive"} style={{ gridColumn: "1/-1" }} className={state.ok ? "admin-status live" : "admin-status warning"}>{state.message}</p> : null}
      <style>{`.action-loading-spinner{display:inline-block;width:14px;height:14px;margin-right:8px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;vertical-align:-2px;animation:action-spin .7s linear infinite}form[aria-busy="true"] button{cursor:wait;opacity:.8}@keyframes action-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.action-loading-spinner{animation-duration:1.5s}}`}</style>
    </form>
  );
}
