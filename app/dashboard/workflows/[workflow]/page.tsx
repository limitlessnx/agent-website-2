import Link from "next/link";
import { Bot, Mail, PhoneCall, Search, Workflow } from "@/components/admin/ServerIcons";

const workflowMap = {
  email: { title: "Email automation", description: "Manage outbound sequences, delivery, replies, lead state updates and follow-up rules.", icon: Mail, modules: ["Lead source", "Sequence builder", "Sending account", "Reply detection", "CRM update"] },
  calls: { title: "Outbound call agent", description: "Configure automated qualification calls, appointment booking, summaries and human handoff.", icon: PhoneCall, modules: ["Call queue", "Voice agent", "Qualification logic", "Calendar booking", "Call summary"] },
  scraping: { title: "Lead scraping agent", description: "Collect, clean, deduplicate and route outbound prospects into organization campaigns.", icon: Search, modules: ["Source actor", "Search criteria", "Data cleaning", "Deduplication", "Campaign routing"] },
} as const;

export default async function PlatformWorkflowPage({ params }: { params: Promise<{ workflow: string }> }) {
  const { workflow } = await params;
  const config = workflowMap[workflow as keyof typeof workflowMap];
  if (!config) return <div className="admin-page"><div className="admin-page-header"><div><p className="admin-kicker">Platform automation</p><h1>Workflow not found</h1></div></div></div>;
  const Icon = config.icon;
  return <div className="admin-page">
    <div className="admin-page-header"><div><p className="admin-kicker">Fluxknight platform workflow</p><h1>{config.title}</h1><p>{config.description}</p></div><span className="admin-status warning">Configuration scaffold</span></div>
    <section className="admin-panel"><div className="admin-panel-header"><div><h2><Icon size={17} /> Workflow modules</h2><p>This is a platform-level automation. Organizations will connect their own credentials, prompts and data without duplicating the engine.</p></div></div><div className="admin-list">
      {config.modules.map((module, index) => <div key={module} className="admin-list-row"><div><strong>{index + 1}. {module}</strong><span>Independent HTTP-connected module</span></div><em>Pending setup</em></div>)}
    </div></section>
    <section className="admin-panel"><div className="admin-panel-header"><div><h2><Workflow size={17} /> Organization assignment</h2><p>After the engine is connected, assign instances to Fluxknight, Limitless Realty, Gencouv or individual client organizations.</p></div><Link className="admin-button secondary" href="/dashboard/workflows">Back to registry</Link></div></section>
  </div>;
}
