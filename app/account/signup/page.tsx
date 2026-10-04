import type { Metadata } from "next";
import AuthExperience from "../AuthExperience";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create Account",
  robots: { index: false, follow: false },
};

export default async function ClientSignupPage({ searchParams }: { searchParams: Promise<{ tx_ref?: string; next?: string; trial?: string; invite?: string; invitation_token?: string }> }) {
  const params = await searchParams;
  return (
    <AuthExperience mode="signup">
      <SignupForm txRef={String(params.tx_ref || "")} nextPath={String(params.next || "/portal")} invitationToken={String(params.invitation_token || params.invite || "")} />
    </AuthExperience>
  );
}
