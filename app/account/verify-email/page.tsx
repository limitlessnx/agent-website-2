import VerifyEmailClient from "./VerifyEmailClient";

export const metadata = { title: "Verify Email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; tx_ref?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <section className="admin-login-page">
      <VerifyEmailClient
        email={String(params.email || "")}
        txRef={String(params.tx_ref || "")}
        nextPath={String(params.next || "/portal")}
      />
    </section>
  );
}
