import SignupForm from "./SignupForm";

export const metadata = { title: "Create Account | Fluxknight" };

export default async function ClientSignupPage({ searchParams }: { searchParams: Promise<{ tx_ref?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <section className="admin-login-page">
      <SignupForm txRef={String(params.tx_ref || "")} nextPath={String(params.next || "/portal")} />
    </section>
  );
}
