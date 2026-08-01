import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import AgentConfigurator from "./AgentConfigurator";

export const dynamic = "force-dynamic";

export default async function AgentConfigurationPage({ params }: { params: Promise<{ agentId: string }> }) {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  const { agentId } = await params;
  return <AgentConfigurator agentId={agentId} />;
}
