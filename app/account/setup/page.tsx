import SetupForm from "./SetupForm";

export const metadata = { title: "Finish Workspace Setup" };

export default function ClientWorkspaceSetupPage() {
  return (
    <section className="admin-login-page">
      <SetupForm />
    </section>
  );
}
