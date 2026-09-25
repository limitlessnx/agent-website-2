import Link from "next/link";
import { getAdminOrganizationContext } from "@/lib/admin-organization-context";

export default async function SocialOrganizationLayout({ children }: { children: React.ReactNode }) {
  const organization = await getAdminOrganizationContext();
  const fluxknightSelected = organization.kind === "system" && organization.id === "fluxknight";

  if (fluxknightSelected) return <>{children}</>;

  const name = organization.kind === "system" ? organization.name : "This organization";
  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Organization module</p>
          <h1>Socials</h1>
          <p>{name} does not have an agentic social media system configured yet.</p>
        </div>
        <span className="admin-status">Not configured</span>
      </header>
      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Organization-specific module</h2>
            <p>The current Socials implementation belongs to Fluxknight. Other system and tenant organizations will receive their own isolated social workspace when configured.</p>
          </div>
        </div>
        <Link className="admin-button secondary-button" href="/dashboard">Return to workspace</Link>
      </section>
    </main>
  );
}
