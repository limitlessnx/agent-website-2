import { signIn } from "./actions";

export const metadata = { title: "Workspace Login | Fluxknight" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <section className="admin-login-page">
      <form action={signIn} className="admin-login-card">
        <div>
          <p className="admin-kicker">Fluxknight Workspace</p>
          <h1>Secure sign in</h1>
          <p className="admin-muted">Your organisation is resolved from your authenticated membership, not from a tenant ID supplied by the browser.</p>
        </div>
        {params.error ? <p className="admin-error">{params.error}</p> : null}
        <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        <button type="submit">Sign in</button>
      </form>
    </section>
  );
}
