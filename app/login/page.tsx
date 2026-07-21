import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Admin Login | Boundless Flux AI",
};

export default function LoginPage() {
  return (
    <section className="admin-login-page">
      <Suspense fallback={<div className="admin-login-card">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
