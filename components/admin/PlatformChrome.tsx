"use client";

import { useEffect, useState } from "react";
import { Activity, X } from "lucide-react";
import styles from "@/components/admin/PlatformChrome.module.css";

export default function PlatformChrome() {
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActivityOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
            onClick={() => setActivityOpen(false)}
          />
          <aside className={styles.drawer} aria-label="Unified activity center">
            <header>
              <div>
                <strong>Activity Center</strong>
                <span>Cross-organization operations</span>
              </div>
              <button
                type="button"
                onClick={() => setActivityOpen(false)}
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
