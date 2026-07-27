import SetupForm from "./SetupForm";

export const metadata = { title: "Finish Workspace Setup | Fluxknight" };

export default function ClientWorkspaceSetupPage() {
  return (
    <section className="admin-login-page">
      <SetupForm />
    </section>
  );
}
