"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardNotification } from "@/lib/dashboard-notifications";
import styles from "./NotificationCenter.module.css";

function severityLabel(value: DashboardNotification["severity"]) {
  return value === "critical" ? "Critical" : value === "warning" ? "Warning" : value === "success" ? "Success" : "Info";
}

export default function NotificationCenter({ initialNotifications }: { initialNotifications: DashboardNotification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => setNotifications(initialNotifications), [initialNotifications]);
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [router]);

  const unread = useMemo(() => notifications.filter((item) => !item.readAt && !item.resolvedAt).length, [notifications]);

  async function markRead(notificationId: string) {
    setBusy(notificationId);
    const response = await fetch("/api/portal/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
    setBusy(null);
    if (!response.ok) return;
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, readAt: now } : item));
  }

  async function markAllRead() {
    setBusy("all");
    const response = await fetch("/api/portal/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setBusy(null);
    if (!response.ok) return;
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.resolvedAt ? item : { ...item, readAt: item.readAt || now }));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div><strong>{unread} unread</strong><span>{notifications.length} total notifications</span></div>
        <button type="button" disabled={!unread || busy === "all"} onClick={markAllRead}>Mark all read</button>
      </div>

      <div className={styles.list}>
        {notifications.map((item) => {
          const unreadItem = !item.readAt && !item.resolvedAt;
          return (
            <article key={item.id} className={`${styles.card} ${unreadItem ? styles.unread : ""} ${item.persistent && !item.resolvedAt ? styles.persistent : ""}`}>
              <div className={styles.head}>
                <div>
                  <span className={`${styles.severity} ${styles[item.severity]}`}>{severityLabel(item.severity)}</span>
                  <span className={styles.category}>{item.category.replaceAll("_", " ")}</span>
                </div>
                <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
              </div>
              <h2>{item.title}</h2>
              <p>{item.message}</p>
              <div className={styles.actions}>
                {item.actionHref && item.actionLabel ? <Link href={item.actionHref}>{item.actionLabel}</Link> : null}
                {unreadItem ? <button type="button" disabled={busy === item.id} onClick={() => markRead(item.id)}>Mark read</button> : <span className={styles.readState}>{item.readAt ? "Read" : "Resolved"}</span>}
              </div>
            </article>
          );
        })}
        {!notifications.length ? <div className={styles.empty}><strong>No notifications yet</strong><span>Workspace health, support, account and lifecycle notices will appear here.</span></div> : null}
      </div>
    </div>
  );
}
