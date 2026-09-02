import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import AgentSelectionBuilder from "./AgentSelectionBuilder";

export const metadata = { title: "Choose Your AI Agents" };
export const dynamic = "force-dynamic";

export default async function AgentSelectionPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  return <AgentSelectionBuilder />;
}
