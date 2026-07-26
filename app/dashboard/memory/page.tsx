import { BrainCircuit, History } from "lucide-react";
import { getPlatformEngineSummary, humanize } from "@/lib/platform-engine";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const { memories, errors } = await getPlatformEngineSummary();
  const customers = new Set(memories.map((item) => item.customer_key)).size;
  return (
    <main className="admin-page">
      <header className="admin-page-header"><div><p className="admin-kicker">Platform Engine</p><h1>Memory Center</h1><p>Durable customer preferences, history and context with source provenance.</p></div></header>
      <section className="admin-metric-grid">
        <article className="admin-metric-card"><p><BrainCircuit size={15} /> Memories</p><strong>{memories.length}</strong><span>Recent durable memory records</span></article>
        <article className="admin-metric-card"><p><History size={15} /> Customers</p><strong>{customers}</strong><span>Distinct customer memory profiles</span></article>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Recent customer memory</h2><p>Every record carries organization scope, type and confidence.</p></div><BrainCircuit size={18} /></div>
        <div className="admin-list">
          {memories.map((item) => <div className="admin-list-row" key={item.id}><div><strong>{item.customer_key}</strong><span>{item.summary}</span><span>{humanize(item.memory_type)} · Confidence {Math.round(Number(item.confidence || 0) * 100)}%</span></div><em>{item.source_type ? humanize(item.source_type) : "Recorded"}</em></div>)}
          {!memories.length ? <p className="admin-empty">Customer memories will appear as agents and workflows persist verified context.</p> : null}
        </div>
      </section>
      {errors.length ? <p className="admin-empty">{errors.join(" · ")}</p> : null}
    </main>
  );
}
