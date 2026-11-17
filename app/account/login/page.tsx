import type { Metadata } from "next";
import AuthExperience from "../AuthExperience";
import ClientLoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function ClientLoginPage({ searchParams }: { searchParams: Promise<{ tx_ref?: string; next?: string; invite?: string; invitation_token?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <AuthExperience mode="login">
      <ClientLoginForm initialError={params.error === "admin_access_denied" ? "This account does not have super-admin access." : params.error === "admin_access_unavailable" ? "Administrator access could not be verified. Please try again." : ""} txRef={String(params.tx_ref || "")} nextPath={String(params.next || "/portal")} invitationToken={String(params.invitation_token || params.invite || "")} />
    </AuthExperience>
  );
}
