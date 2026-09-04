import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create Account",
  robots: { index: false, follow: false },
};

export default async function ClientSignupPage({ searchParams }: { searchParams: Promise<{ tx_ref?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <section className="admin-login-page">
      <SignupForm txRef={String(params.tx_ref || "")} nextPath={String(params.next || "/portal")} />
    </section>
  );
}
