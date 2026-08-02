import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Admin Login | Fluxknight" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <section className="admin-login-page">
      {params.error ? <p className="admin-error">{params.error}</p> : null}
      <Suspense fallback={<div className="admin-login-card">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
