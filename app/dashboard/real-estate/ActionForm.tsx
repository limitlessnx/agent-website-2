"use client";
import { useActionState, type ReactNode } from "react";
export type ActionResult = { ok: boolean; message: string };
export default function ActionForm({ action, children, label = "Save" }: { action: (previous: ActionResult, data: FormData) => Promise<ActionResult>; children: ReactNode; label?: string }) {
  const [state, submit, pending] = useActionState(action, { ok: false, message: "" });
  return <form action={submit} className="admin-form-grid compact">
    {children}
    <button disabled={pending} type="submit">{pending ? "Saving…" : label}</button>
    {state.message ? <p role={state.ok ? "status" : "alert"} style={{ gridColumn: "1/-1" }} className={state.ok ? "admin-status live" : "admin-status warning"}>{state.message}</p> : null}
  </form>;
}
