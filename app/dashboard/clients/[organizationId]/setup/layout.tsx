import type { ReactNode } from "react";
import OnboardingResourcesPanel from "./OnboardingResourcesPanel";

export default async function TenantSetupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;

  return (
    <>
      {children}
      <section className="admin-page" style={{ paddingTop: 0 }}>
        <section className="admin-panel" id="onboarding-resources">
          <div className="admin-panel-header">
            <div>
              <h2>Onboarding resources</h2>
              <p>Files, business notes and resource links submitted by this client during onboarding.</p>
            </div>
          </div>
          <OnboardingResourcesPanel organizationId={organizationId} />
        </section>
      </section>
    </>
  );
}
