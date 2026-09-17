import type { Metadata } from "next";
import AuthExperience from "../AuthExperience";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create Account",
  robots: { index: false, follow: false },
};

export default async function ClientSignupPage({ searchParams }: { searchParams: Promise<{ tx_ref?: string; next?: string; trial?: string }> }) {
  const params = await searchParams;
  const trialPlan = params.trial === "basic" ? "basic" : "";
  return (
    <AuthExperience mode="signup">
      <SignupForm txRef={String(params.tx_ref || "")} nextPath={String(params.next || "/portal")} trialPlan={trialPlan} />
    </AuthExperience>
  );
}
