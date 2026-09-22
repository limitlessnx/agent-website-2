"use client";

import { useCallback, useRef, useState } from "react";
import { Activity, X } from "@/components/admin/ServerIcons";
import styles from "@/components/admin/PlatformChrome.module.css";
import { useDialogFocusTrap } from "@/components/admin/useDialogFocusTrap";

export default function PlatformChrome() {
  const [activityOpen, setActivityOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeActivity = useCallback(() => setActivityOpen(false), []);
  useDialogFocusTrap(activityOpen, drawerRef, closeActivity);

  return (
    <>
      <button
        type="button"
        className={styles.activityButton}
        aria-label="Open activity center"
        onClick={() => setActivityOpen(true)}
      >
        <Activity size={17} />
        <i />
      </button>

      {activityOpen ? (
        <>
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Close activity center"
            onClick={closeActivity}
            tabIndex={-1}
            aria-hidden="true"
          />
          <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="activity-center-title" tabIndex={-1} data-state="open">
            <header>
              <div>
                <strong id="activity-center-title">Activity Center</strong>
                <span>Cross-organization operations</span>
              </div>
              <button
                type="button"
                onClick={closeActivity}
                aria-label="Close activity center"
              >
                <X size={18} />
              </button>
            </header>
            <div className={styles.activityList}>
              <article>
                <i className={styles.live} />
                <div>
                  <strong>Maia WhatsApp operations active</strong>
                  <span>Limitless Realty · live automation</span>
                </div>
              </article>
              <article>
                <i className={styles.info} />
                <div>
                  <strong>Campaign delivery reporting enabled</strong>
                  <span>Sent, delivered, pending and failed states</span>
                </div>
              </article>
              <article>
                <i className={styles.warn} />
                <div>
                  <strong>Review incomplete operational records</strong>
                  <span>Use workspace action cards to resolve blockers</span>
                </div>
              </article>
            </div>
            <a href="/dashboard/automations">Open automation control</a>
          </aside>
        </>
      ) : null}
    </>
  );
}
