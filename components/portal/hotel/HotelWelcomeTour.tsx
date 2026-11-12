"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./HotelWelcomeTour.module.css";

const steps = [
  { title: "Welcome to your hotel workspace", description: "Open your hotel dashboard to manage bookings, rooms and guests.", target: "hotel-dashboard-header" },
  { title: "Today’s stays", description: "Switch between arrivals and departures to see which guests are due today.", target: "hotel-dashboard-stays" },
  { title: "Room availability", description: "Choose dates and guest count to check which rooms are available.", target: "hotel-dashboard-rooms" },
  { title: "Recent bookings", description: "Open a recent booking to review the stay and its current status.", target: "hotel-dashboard-bookings" },
  { title: "Guest conversations", description: "Open the inbox to review and continue conversations with guests.", target: "hotel-dashboard-conversations" },
  { title: "Needs your attention", description: "Check pending payments, enquiries, handovers and overdue departures here.", target: "hotel-dashboard-attention" },
];

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export default function HotelWelcomeTour({ workspaceId, canViewConversations }: { workspaceId: string; canViewConversations: boolean }) {
  const storageKey = `fluxknight-hotel-welcome-tour-v2:${workspaceId}`;
  const seen = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(storageKey) === "done"; }
    catch { return true; }
  }, () => true);
  const [selection, setSelection] = useState<number | null>();
  const step = selection === undefined ? (seen ? null : 0) : selection;
  const visibleSteps = steps.filter(item => canViewConversations || item.target !== "hotel-dashboard-conversations");
  const current = step === null ? undefined : visibleSteps[step];
  const target = current?.target;
  const open = Boolean(current);
  const dialog = useRef<HTMLDialogElement>(null);
  const replay = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    return () => element.close();
  }, [open]);

  useEffect(() => {
    if (!target) return;
    const element = document.querySelector(`[data-tour="${target}"]`);
    element?.setAttribute("data-tour-active", "");
    element?.scrollIntoView({ behavior: "instant", block: "start" });
    title.current?.focus({ preventScroll: true });
    return () => element?.removeAttribute("data-tour-active");
  }, [target]);

  function finish() {
    try { localStorage.setItem(storageKey, "done"); } catch {}
    dialog.current?.close();
    setSelection(null);
    replay.current?.focus({ preventScroll: true });
  }

  return <>
    <button ref={replay} type="button" className={styles.replay} onClick={() => setSelection(0)}>Take dashboard tour</button>
    <dialog ref={dialog} className={styles.panel} aria-labelledby="hotel-tour-title" aria-describedby="hotel-tour-description" onCancel={event => { event.preventDefault(); finish(); }}>
      {current && step !== null && <>
        <p className={styles.count}>Step {step + 1} of {visibleSteps.length}</p>
        <h2 id="hotel-tour-title" ref={title} tabIndex={-1}>{current.title}</h2>
        <p id="hotel-tour-description">{current.description}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={finish}>Skip tour</button>
          {step > 0 && <button type="button" className={styles.skip} onClick={() => setSelection(step - 1)}>Back</button>}
          <button type="button" className={styles.next} onClick={() => step === visibleSteps.length - 1 ? finish() : setSelection(step + 1)}>{step === visibleSteps.length - 1 ? "Finish" : "Next"}</button>
        </div>
      </>}
    </dialog>
  </>;
}
