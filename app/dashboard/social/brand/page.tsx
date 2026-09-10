import Link from "next/link";
import { updateSocialBrandAction } from "@/app/dashboard/social/actions";
import { getSocialBrand } from "@/lib/social";

const fieldStyle = { display: "grid", gap: 8 } as const;
const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--admin-border, #2d2d35)", background: "transparent", color: "inherit" } as const;

export default async function SocialBrandPage() {
  const brand = await getSocialBrand();

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social</p>
          <h1>Brand Brain</h1>
          <p>Canonical context for strategy, copy and creative agents. One source of truth beats seven prompts disagreeing with each other.</p>
        </div>
        <Link href="/dashboard/social" className="admin-status">Back to Social</Link>
      </header>

      <section className="admin-panel">
        {brand ? (
          <form action={updateSocialBrandAction} style={{ display: "grid", gap: 20 }}>
            <div className="admin-panel-header"><div><h2>{brand.name}</h2><p>Brand key: {brand.slug}</p></div><span className="admin-status live">Active</span></div>

            <label style={fieldStyle}>
              <strong>Voice & tone</strong>
              <textarea style={{ ...inputStyle, minHeight: 90 }} name="tone" defaultValue={brand.tone} />
            </label>
            <label style={fieldStyle}>
              <strong>Audience</strong>
              <textarea style={{ ...inputStyle, minHeight: 100 }} name="audience" defaultValue={brand.audience} />
            </label>
            <label style={fieldStyle}>
              <strong>Content pillars</strong>
              <textarea style={{ ...inputStyle, minHeight: 130 }} name="content_pillars" defaultValue={brand.content_pillars.join("\n")} />
              <small>One per line.</small>
            </label>
            <label style={fieldStyle}>
              <strong>Products</strong>
              <textarea style={{ ...inputStyle, minHeight: 110 }} name="products" defaultValue={brand.products.join("\n")} />
              <small>One per line.</small>
            </label>
            <label style={fieldStyle}>
              <strong>Approved CTAs</strong>
              <textarea style={{ ...inputStyle, minHeight: 100 }} name="ctas" defaultValue={brand.ctas.join("\n")} />
              <small>One per line.</small>
            </label>

            <div className="admin-list-row">
              <div><strong>Visual system</strong><span>{Object.entries(brand.visual_rules).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</span></div>
              <em>locked</em>
            </div>

            <div><button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>Save Brand Brain</button></div>
          </form>
        ) : <p>No Social Brand exists for this organization.</p>}
      </section>
    </main>
  );
}
