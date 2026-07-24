import ClientLoginForm from "./LoginForm";

export const metadata = { title: "Client Login | Fluxknight" };

export default function ClientLoginPage() {
  return (
    <section className="admin-login-page">
      <ClientLoginForm />
    </section>
  );
}
