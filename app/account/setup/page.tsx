import type { Metadata } from "next";
import SetupForm from "./SetupForm";

export const metadata: Metadata = {
  title: "Finish Workspace Setup",
  robots: { index: false, follow: false },
};

export default function ClientWorkspaceSetupPage() {
  return (
    <section className="admin-login-page">
      <SetupForm />
    </section>
  );
}
