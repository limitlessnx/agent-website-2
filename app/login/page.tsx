import Link from "next/link";
import { ArrowLeft } from "@/components/admin/ServerIcons";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Admin Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <section className="admin-login-page">
      <Link
        href="/"
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          zIndex: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          border: "1px solid rgba(174,112,255,.35)",
          borderRadius: 10,
          background: "rgba(20,8,38,.82)",
          color: "#f4edff",
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
          backdropFilter: "blur(14px)",
        }}
      >
        <ArrowLeft size={16} /> Homepage
      </Link>
      {params.error ? <p className="admin-error">{params.error}</p> : null}
      <Suspense fallback={<div className="admin-login-card">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
