import { BrainCircuit, ShieldCheck } from "lucide-react";
import { getAiModelControlData } from "@/lib/ai-model-control";
import AiModelControl from "./AiModelControl";

export const dynamic = "force-dynamic";

export default async function AiModelsPage() {
  try {
    const data = await getAiModelControlData();

    return (
      <main className="admin-page">
        <header className="admin-page-header">
          <div>
            <p className="admin-kicker">Platform governance</p>
            <h1>AI Model Control</h1>
            <p>Register supported models and assign exactly one approved model to each organization.</p>
          </div>
          <BrainCircuit size={22} />
        </header>
        <AiModelControl {...data} />
      </main>
    );
  } catch (error) {
    return (
      <main className="admin-page">
        <header className="admin-page-header"><div><p className="admin-kicker">Platform governance</p><h1>AI Model Control</h1></div></header>
        <section className="admin-panel"><div className="admin-list-row compact"><div><strong>Model control unavailable</strong><span>{error instanceof Error ? error.message : "Unable to load model controls."}</span></div><ShieldCheck size={16} /></div></section>
      </main>
    );
  }
}
