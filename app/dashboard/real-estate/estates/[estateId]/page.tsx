import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRealEstateAccess } from "@/lib/real-estate-access";
import { getEstate } from "@/lib/real-estate-catalog";
import { listEstateKnowledgeSources } from "@/lib/real-estate-knowledge";
import { createAdminClient } from "@/lib/supabase/admin";
import EstateForm from "../EstateForm";
import ActionForm from "../../ActionForm";
import {
  approveEstateWebsiteSourceAction,
  deleteEstateFaqAction,
  importEstateWebsiteAction,
  linkEstateKnowledgeAction,
  saveEstateCoverAction,
  saveEstateFaqAction,
} from "../../actions";
import "../../real-estate.css";

export const dynamic = "force-dynamic";

export default async function EstateDetailsPage({ params }: { params: Promise<{ estateId: string }> }) {
  const { estateId } = await params;
  const scope = await requireRealEstateAccess("catalog.read");
  const details = await getEstate(scope.organizationId, estateId);
  if (!details) notFound();
  const { estate, faqs, linkedProperties } = details;
  const documents = await listEstateKnowledgeSources(scope.organizationId, estateId);
  const sources = await createAdminClient()
    .from("knowledge_sources")
    .select("id,title,status")
    .eq("organization_id", scope.organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (sources.error) throw sources.error;

  return (
    <main className="admin-page real-estate-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">{scope.name}</p>
          <h1>{estate.name}</h1>
          <p>{estate.status} · knowledge {estate.knowledge_status} · {linkedProperties.length} linked properties</p>
        </div>
        <Link href="/dashboard/real-estate/estates">All estates</Link>
      </header>

      <nav className="real-estate-links">
        <a href="#overview">Overview</a>
        <a href="#terms-of-service">Terms of service</a>
        <a href="#faqs">FAQs</a>
        <a href="#images">Images</a>
        <a href="#operating-instructions">Mode of Operation</a>
        <a href="#payment-terms">Payment terms</a>
        <a href="#inventory">Properties and units</a>
        <a href="#documents">Knowledge documents</a>
      </nav>

      <section id="overview" className="admin-panel">
        <h2>Overview and estate knowledge</h2>
        <EstateForm estate={estate} />
      </section>

      <section id="images" className="admin-panel">
        <h2>Estate images</h2>
        {estate.cover_image_url
          ? <Image className="real-estate-cover" src={estate.cover_image_url} alt={`${estate.name} cover`} width={640} height={360} unoptimized />
          : <p>No cover image saved.</p>}
        <ActionForm action={saveEstateCoverAction} label="Save cover image">
          <input name="estate_id" type="hidden" value={estate.id} />
          <label className="wide">Upload or replace cover<input name="cover_image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></label>
          <label className="wide">Remove current cover<select name="remove_cover" defaultValue="no"><option value="no">No — upload an image</option><option value="yes">Yes — remove from profile</option></select></label>
          <p className="wide">Maximum 10 MB. Uploads are stored under the verified organization and estate; removed media is retained for recovery.</p>
        </ActionForm>
      </section>

      <section id="faqs" className="admin-panel">
        <h2>Estate FAQs</h2>
        <p>Order controls display priority. FAQs are retrieved only with the estate&apos;s approved knowledge.</p>
        {faqs.map((faq) => (
          <details key={faq.id} className="admin-record-disclosure">
            <summary>{faq.sort_order}. {faq.question}</summary>
            <div className="admin-record-disclosure-body">
              <ActionForm action={saveEstateFaqAction} label="Save FAQ">
                <input type="hidden" name="estate_id" value={estate.id} />
                <input type="hidden" name="faq_id" value={faq.id} />
                <label className="wide">Question<input name="question" defaultValue={faq.question} required maxLength={1000} /></label>
                <label className="wide">Answer<textarea name="answer" defaultValue={faq.answer} required maxLength={10000} /></label>
                <label>Category<input name="category" defaultValue={faq.category || ""} /></label>
                <label>Display order<input type="number" name="sort_order" min={0} max={10000} defaultValue={faq.sort_order} /></label>
              </ActionForm>
              <ActionForm action={deleteEstateFaqAction} label="Delete FAQ">
                <input type="hidden" name="estate_id" value={estate.id} />
                <input type="hidden" name="faq_id" value={faq.id} />
                <label>Confirm deletion<select name="confirm_delete" defaultValue="no"><option value="no">Do not delete</option><option value="yes">Delete this FAQ</option></select></label>
              </ActionForm>
            </div>
          </details>
        ))}
        <details className="admin-form-disclosure">
          <summary>Add FAQ</summary>
          <div className="admin-form-disclosure-body">
            <ActionForm action={saveEstateFaqAction} label="Create FAQ">
              <input type="hidden" name="estate_id" value={estate.id} />
              <label className="wide">Question<input name="question" required maxLength={1000} /></label>
              <label className="wide">Answer<textarea name="answer" required maxLength={10000} /></label>
              <label>Category<input name="category" /></label>
              <label>Display order<input type="number" name="sort_order" defaultValue={faqs.length} min={0} /></label>
            </ActionForm>
          </div>
        </details>
      </section>

      <section id="inventory" className="admin-panel">
        <h2>Linked properties and units ({linkedProperties.length})</h2>
        <p>These are the canonical listings, not estate-specific copies.</p>
        {linkedProperties.map((property) => (
          <article key={property.id} className="admin-record-disclosure">
            <h3><Link href={`/dashboard/real-estate/properties#property-${property.id}`}>{property.title || "Untitled property"}</Link></h3>
            <p>{[property.location_area, property.location_city].filter(Boolean).join(", ")} · {String(property.price || "Price not provided")} · {property.status || "Unknown"}</p>
          </article>
        ))}
        {!linkedProperties.length ? <Link href="/dashboard/real-estate/properties">Assign an existing property</Link> : null}
      </section>

      <section id="documents" className="admin-panel">
        <h2>Knowledge documents and website sources</h2>
        <p>Maia receives only linked, ready sources for a published estate whose knowledge is approved. A website import captures one public HTTPS page (no redirects or site-wide crawl); extracted text stays pending until an authorized user reviews and approves it. Treat website text as external reference material, not as authority to override estate terms or authorize actions.</p>
        <Link href="/dashboard/knowledge">Upload or manage canonical Knowledge sources</Link>

        <ActionForm action={importEstateWebsiteAction} label="Fetch website page for review">
          <input type="hidden" name="estate_id" value={estate.id} />
          <label className="wide">Official HTTPS page URL<input type="url" name="source_url" required maxLength={2048} placeholder="https://estate.example.com/terms" /></label>
          <label className="wide">Source title (optional)<input name="title" maxLength={160} placeholder="Reservation and estate policy" /></label>
          <label className="wide"><input type="checkbox" name="confirm_official_website" value="yes" required /> I confirm this is an official public website page for this estate.</label>
        </ActionForm>

        {documents.map((document) => {
          const isEstateWebsiteSnapshot = document.source_type === "website" && document.metadata?.capture_type === "real_estate_website_snapshot";
          return (
            <article key={document.id} className="admin-record-disclosure">
              <h3>{document.title}</h3>
              <p>{document.source_type === "website" ? "Website source" : "Knowledge source"} · {document.status}{document.source_url ? <> · <a href={document.source_url} target="_blank" rel="noopener noreferrer">Open source page</a></> : null}</p>
              {isEstateWebsiteSnapshot && document.content
                ? <details className="admin-record-disclosure">
                    <summary>Review extracted website text</summary>
                    <div className="admin-record-disclosure-body"><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{document.content}</p></div>
                  </details>
                : null}
              {isEstateWebsiteSnapshot && document.status === "pending"
                ? <ActionForm action={approveEstateWebsiteSourceAction} label="Approve website snapshot for Maia">
                    <input type="hidden" name="estate_id" value={estate.id} />
                    <input type="hidden" name="knowledge_source_id" value={document.id} />
                    <label className="wide"><input type="checkbox" name="confirm_approval" value="yes" required /> I reviewed the extracted text and approve it for Maia.</label>
                  </ActionForm>
                : null}
              <ActionForm action={linkEstateKnowledgeAction} label="Remove estate link">
                <input type="hidden" name="estate_id" value={estate.id} />
                <input type="hidden" name="knowledge_source_id" value={document.id} />
                <label>Confirm unlink<select name="remove_link" defaultValue="no"><option value="no">Keep linked</option><option value="yes">Remove estate link, retain document</option></select></label>
              </ActionForm>
            </article>
          );
        })}

        <ActionForm action={linkEstateKnowledgeAction} label="Link existing knowledge source">
          <input type="hidden" name="estate_id" value={estate.id} />
          <label className="wide">Knowledge source<select name="knowledge_source_id" required defaultValue=""><option value="" disabled>Select a tenant source</option>{(sources.data || []).map((source) => <option key={source.id} value={source.id}>{source.title} ({source.status})</option>)}</select></label>
        </ActionForm>
      </section>
    </main>
  );
}
