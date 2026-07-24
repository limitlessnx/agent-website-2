"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClientLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/client-auth/logout", { method: "POST" });
    router.push("/account/login");
    router.refresh();
  }

  return <button type="button" className="admin-button secondary" disabled={loading} onClick={logout}>{loading ? "Signing out..." : "Sign out"}</button>;
}
