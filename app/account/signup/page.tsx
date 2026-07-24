import SignupForm from "./SignupForm";

export const metadata = { title: "Create Account | Fluxknight" };

export default function ClientSignupPage() {
  return (
    <section className="admin-login-page">
      <SignupForm />
    </section>
  );
}
