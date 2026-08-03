import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import PortalSidebar from "./PortalSidebar";
import ClientLogoutButton from "./ClientLogoutButton";
import "./portal.css";
import "./marketplace.css";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getClientSession();
  if (!session) redirect("/account/login");

  const profile = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  if (!profile || profile.status === "in_progress") redirect("/onboarding");

  return (
    <div className="portal-shell">
      <PortalSidebar organization={profile.business_name || session.organizationSlug} />
      <section className="portal-main">
        <header className="portal-topbar">
          <div>
            <span>Client workspace</span>
            <strong>{profile.business_name || session.organizationSlug}</strong>
          </div>
          <ClientLogoutButton />
        </header>
        {children}
      </section>
    </div>
  );
}
