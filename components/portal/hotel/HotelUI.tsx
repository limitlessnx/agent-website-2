"use client";
import { cloneElement, isValidElement, useEffect, useId, useRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";
import styles from "./HotelWorkspace.module.css";

export type HotelMutation = <T = Record<string, unknown>>(body: Record<string, unknown>, message: string, endpoint?: string) => Promise<T>;
export async function hotelRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", signal: AbortSignal.timeout(20000), ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Unable to complete this request. Try again.");
  return body as T;
}
export function Action({ secondary, danger, className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean; danger?: boolean }) {
  return <button {...props} type={type} className={[styles.button, secondary ? styles.secondary : "", danger ? styles.danger : "", className].join(" ")} />;
}
export function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: ReactNode }) {
  const id=useId();
  const control=isValidElement<{id?:string;"aria-describedby"?:string}>(children)?children:null;
  const controlId=control?.props.id||id;
  return <div className={`${styles.field} ${wide ? styles.wide : ""}`}><label htmlFor={controlId}>{label}</label>{control?cloneElement(control,{id:controlId,"aria-describedby":[control.props["aria-describedby"],hint?`${id}-hint`:null].filter(Boolean).join(" ")||undefined}):children}{hint ? <small id={`${id}-hint`}>{hint}</small> : null}</div>;
}
export function Status({ value }: { value: string }) {
  return <span className={styles.badge} data-state={value}>{value.replaceAll("_", " ")}</span>;
}
export function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "Dates to confirm";
}
export function Dialog({ title, subtitle, busy, error, close, children }: { title: string; subtitle?: string; busy: boolean; error: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) close(); }} onClick={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <div className={styles.dialogSurface}>
      <header className={styles.dialogHeader}><div><p className={styles.eyebrow}>HOTEL WORKSPACE</p><h2 id={titleId}>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div><button type="button" aria-label="Close panel" className={styles.iconButton} disabled={busy} onClick={close}><X size={20}/></button></header>
      <div className={styles.dialogBody}>{error ? <p className={styles.error} role="alert">{error}</p> : null}{children}</div>
    </div>
  </dialog>;
}
export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className={styles.empty}><div className={styles.emptyMark} aria-hidden="true">↗</div><h3>{title}</h3><p>{children}</p>{action}</div>;
}
