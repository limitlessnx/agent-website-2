import type { Metadata } from "next";
import AccountModeClient from "./AccountModeClient";

export const metadata: Metadata = { title: "Choose your Fluxknight workspace", robots: { index: false, follow: false } };

export default function ChooseModePage() {
  return <section className="admin-login-page"><AccountModeClient /></section>;
}
