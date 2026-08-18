import ClientLoginForm from "./LoginForm";

export const metadata = { title: "Client Login | Fluxknight" };

export default async function ClientLoginPage({ searchParams }: { searchParams: Promise<{ tx_ref?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <section className="admin-login-page">
      <ClientLoginForm txRef={String(params.tx_ref || "")} nextPath={String(params.next || "/portal")} />
    </section>
  );
}
