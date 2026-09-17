import type { Metadata } from "next";
import AuthExperience from "../AuthExperience";
import ClientLoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Client Login",
  robots: { index: false, follow: false },
};

export default async function ClientLoginPage({ searchParams }: { searchParams: Promise<{ tx_ref?: string; next?: string }> }) {
  const params = await searchParams;
  return (
    <AuthExperience mode="login">
      <ClientLoginForm txRef={String(params.tx_ref || "")} nextPath={String(params.next || "/portal")} />
    </AuthExperience>
  );
}
