import { Bot, Building2, Search, Users, Workflow } from "lucide-react";
import { getLeads, getN8nStatus, getProperties } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";

type SearchPageProps = { searchParams: Promise<{ q?: string }> };

function includes(value: unknown, query: string) {
  return String(value || "").toLowerCase().includes(query);
}

export default async function GlobalSearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = String(params.q || "").trim().toLowerCase();
  const [leads, properties, n8n] = await Promise.all([getLeads(1000), getProperties(1000), getN8nStatus()]);

  const leadResults = query
    ? leads.filter((lead) => [lead.name, lead.phone, lead.email, lead.budget, lead.location_preference, lead.property_type, lead.purpose].some((value) => includes(value, query))).slice(0, 25)
    : [];
  const propertyResults = query
    ? properties.filter((property) => [property.title, property.location_area, property.location_city, property.type, property.description, property.status].some((value) => includes(value, query))).slice(0, 25)
    : [];
  const workflowResults = query
    ? n8n.workflows.filter((workflow) => [workflow.name, workflow.id].some((value) => includes(value, query))).slice(0, 25)
    : [];

  const total = leadResults.length + propertyResults.length + workflowResults.length;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Global Search</p>
          <h1>Search the Fluxknight control plane</h1>
          <p>Search organization records, CRM data, property knowledge and workflow infrastructure from one place.</p>
        </div>
      </header>

      {!query ? (
        <section className="admin-panel">
          <div className="admin-list-row compact"><div><strong>Start with the global search bar</strong><span>Try a client name, phone number, location, estate, agent or workflow.</span></div><Search size={17} /></div>
        </section>
      ) : null}

      {query ? <p className="admin-muted">Found {total} visible result(s) for “{params.q}”.</p> : null}

      {leadResults.length ? (
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>CRM Leads</h2><p>{leadResults.length} matching records</p></div><Users size={17} /></div>
          <div className="admin-list">
            {leadResults.map((lead) => (
              <a className="admin-list-row compact" href="/dashboard/limitless/leads" key={lead.id}>
                <div><strong>{lead.name || "Unnamed lead"}</strong><span>{[lead.phone, lead.location_preference, lead.budget].filter(Boolean).join(" · ")}</span></div><em>{lead.status || lead.score || "lead"}</em>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {propertyResults.length ? (
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Property Knowledge</h2><p>{propertyResults.length} matching records</p></div><Building2 size={17} /></div>
          <div className="admin-list">
            {propertyResults.map((property) => (
              <a className="admin-list-row compact" href="/dashboard/limitless/properties" key={property.id}>
                <div><strong>{property.title}</strong><span>{[property.location_area, property.location_city, property.price].filter(Boolean).join(" · ")}</span></div><em>{property.status || property.type || "property"}</em>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {workflowResults.length ? (
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Workflow Registry</h2><p>{workflowResults.length} matching workflows</p></div><Workflow size={17} /></div>
          <div className="admin-list">
            {workflowResults.map((workflow) => (
              <a className="admin-list-row compact" href="/dashboard/workflows" key={workflow.id}>
                <div><strong>{workflow.name}</strong><span>{workflow.id}</span></div><em>{workflow.active ? "active" : "inactive"}</em>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {query && total === 0 ? (
        <section className="admin-panel"><div className="admin-list-row compact"><div><strong>No visible record matched</strong><span>Try a shorter name, phone fragment, estate, location or workflow keyword.</span></div><Bot size={17} /></div></section>
      ) : null}
    </main>
  );
}
