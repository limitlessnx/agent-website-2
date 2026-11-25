import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { ensureClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import SetupProgress from "./SetupProgress";

export const dynamic = "force-dynamic";
export default async function SetupPage() {
  const session = await getClientSession();
  if (!session || session.role !== "owner" || session.isAdminPreview) redirect("/portal");
  const profile = await ensureClientOnboardingProfile({organizationId:session.organizationId,membershipId:session.membershipId,userId:session.userId,businessName:session.organizationSlug,email:session.email}).catch(()=>null);
  if (!profile) return <main className="portal-page"><p role="alert">Setup information unavailable. Please retry.</p></main>;
  return <SetupProgress profile={profile}/>;
}
