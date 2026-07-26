import OnboardingClient from "../onboarding/OnboardingClient";
import "./onboarding.css";

export const metadata = { title: "Managed Setup | Fluxknight" };

export default async function ManagedOnboardingPage({ searchParams }: { searchParams: Promise<{ id?: string; token?: string }> }) {
  const params = await searchParams;
  const onboardingId = String(params.id || "");
  const token = String(params.token || "");

  if (!onboardingId || !token) {
    return (
      <main className="onboarding-shell">
        <section className="onboarding-card">
          <p className="admin-kicker">Fluxknight Managed Setup</p>
          <h1>Onboarding access required</h1>
          <p>Use the secure onboarding link sent after your payment was confirmed.</p>
        </section>
      </main>
    );
  }

  return <OnboardingClient onboardingId={onboardingId} token={token} />;
}
