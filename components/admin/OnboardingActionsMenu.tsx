import Link from "next/link";
import { ChevronDown, ClipboardList, UserPlus, Users } from "lucide-react";

export default function OnboardingActionsMenu() {
  return (
    <details style={{ position: "relative" }}>
      <summary
        className="admin-button secondary"
        style={{ listStyle: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        <ClipboardList size={15} /> Client onboarding <ChevronDown size={14} />
      </summary>
      <div
        className="admin-panel"
        style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 8px)",
          width: 260,
          zIndex: 40,
          padding: 8,
          display: "grid",
          gap: 6,
          boxShadow: "0 18px 50px rgba(0,0,0,.28)",
        }}
      >
        <Link className="admin-button secondary" href="/dashboard/onboarding#new-client">
          <UserPlus size={15} /> Start new client
        </Link>
        <Link className="admin-button secondary" href="/dashboard/onboarding">
          <ClipboardList size={15} /> Onboarding queue
        </Link>
        <Link className="admin-button secondary" href="/dashboard/clients">
          <Users size={15} /> Tenant registry
        </Link>
      </div>
    </details>
  );
}
