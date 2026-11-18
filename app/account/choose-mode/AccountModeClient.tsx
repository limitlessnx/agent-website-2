"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, Check, Users } from "@/components/admin/ServerIcons";
import styles from "./AccountModeClient.module.css";

export default function AccountModeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewGoogleAccount =
    searchParams.get("source") === "google" && searchParams.get("new_account") === "1";
  const [loading, setLoading] = useState<"organization" | "manager" | null>(null);
  const [error, setError] = useState("");

  async function choose(accountMode: "organization" | "manager") {
    setLoading(accountMode);
    setError("");
    try {
      const response = await fetch("/api/client-auth/account-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_mode: accountMode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "Unable to save your account choice.");
        return;
      }
      router.push(result.redirect_to || (accountMode === "manager" ? "/manage-organizations" : "/account/setup"));
      router.refresh();
    } catch {
      setError("We could not save your account choice. Check your connection and try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="admin-login-card">
      <div className={styles.heading}>
        <p className="admin-kicker">{isNewGoogleAccount ? "GOOGLE SIGN-IN SUCCESSFUL" : "FLUXKNIGHT WORKSPACE ACCESS"}</p>
        <h1>{isNewGoogleAccount ? "Continue creating your account" : "How will you use Fluxknight?"}</h1>
        <p className="admin-muted">
          {isNewGoogleAccount
            ? "Your Google identity is verified. Choose how you want to use Fluxknight to finish setting up your account."
            : "Choose how you want to use your account. You can manage organizations without creating a business workspace."}
        </p>
      </div>

      <div className={styles.options} aria-label="Choose account type">
        <button
          type="button"
          className={styles.choiceCard}
          onClick={() => choose("organization")}
          disabled={Boolean(loading)}
          aria-busy={loading === "organization"}
        >
          <span className={styles.choiceIcon}><Building2 size={20} /></span>
          <span className={styles.choiceCopy}>
            <span className={styles.choiceTitle}>
              {loading === "organization" ? "Starting your organization…" : "Organization owner"}
            </span>
            <span className={styles.choiceDescription}>Start an Organization and set up a workspace for your business.</span>
          </span>
          <span className={styles.choiceArrow} aria-hidden="true">
            {loading === "organization" ? <span className={styles.loadingMark}>…</span> : <ArrowRight size={18} />}
          </span>
        </button>

        <button
          type="button"
          className={styles.choiceCard}
          onClick={() => choose("manager")}
          disabled={Boolean(loading)}
          aria-busy={loading === "manager"}
        >
          <span className={styles.choiceIcon}><Users size={20} /></span>
          <span className={styles.choiceCopy}>
            <span className={styles.choiceTitle}>
              {loading === "manager" ? "Opening organization access…" : "Manager"}
            </span>
            <span className={styles.choiceDescription}>Manage Organizations using an Access ID from the owner. Request access, then wait for owner approval.</span>
          </span>
          <span className={styles.choiceArrow} aria-hidden="true">
            {loading === "manager" ? <span className={styles.loadingMark}>…</span> : <ArrowRight size={18} />}
          </span>
        </button>
      </div>

      {error ? <div className="admin-error" role="alert"><p>{error}</p><Link href="/account/login">Sign in again</Link></div> : null}
      <p className={styles.securityNote}><Check size={14} /> Your access is protected by organization-level permissions.</p>
    </div>
  );
}
