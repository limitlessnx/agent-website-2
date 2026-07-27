import VerifyEmailClient from "./VerifyEmailClient";

export const metadata = { title: "Verify Email | Fluxknight" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const params = await searchParams;
  return (
    <section className="admin-login-page">
      <VerifyEmailClient email={String(params.email || "")} />
    </section>
  );
}
