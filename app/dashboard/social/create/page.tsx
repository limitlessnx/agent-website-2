import { getSocialBrand } from "@/lib/social";
import { socialWeeklyPostCount } from "@/lib/social-week";
import Link from "next/link";
import RealtySocialCenter from "@/components/admin/RealtySocialCenter";
import { requireTenant } from "@/lib/tenant";
import { REALTY_SOCIAL_ORGANIZATION } from "@/lib/social-real-estate-policy";
import { createSocialPostAction, generateWeeklySocialPlanAction } from "@/app/dashboard/social/actions";

const fieldStyle = { display: "grid", gap: 8 } as const;
const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--admin-border, #2d2d35)", background: "transparent", color: "inherit" } as const;

export const maxDuration = 300;

export default async function CreateSocialPostPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const brand = await getSocialBrand();
  const {organizationId} = await requireTenant();
  if(organizationId===REALTY_SOCIAL_ORGANIZATION) return <RealtySocialCenter brand={brand} error={(await searchParams).error} manual/>;
  const postCount = socialWeeklyPostCount(brand?.metadata);
  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social</p>
          <h1>Create content</h1>
          <p>Create one controlled draft or prepare the next weekly review batch from the Brand Brain.</p>
        </div>
        <Link href="/dashboard/social" className="admin-status">Back to Social</Link>
      </header>

      <section className="admin-panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <p className="admin-kicker">Phase 3.1</p>
            <h2 style={{ marginTop: 4 }}>AI Content Brain</h2>
            <p style={{ maxWidth: 760 }}>
              Reads the active Fluxknight Brand Brain and creates one weekly strategy plus {postCount} post drafts with hooks, captions, CTAs, formats, platforms and creative briefs.
            </p>
          </div>
          <form action={generateWeeklySocialPlanAction}>
            <button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>
              Generate this week&apos;s {postCount} posts
            </button>
          </form>
          <small style={{ opacity: 0.7 }}>One batch per brand/week. Slides are prepared in the background; review and approval are required before scheduling.</small>
        </div>
      </section>

      <section className="admin-panel">
        <form action={createSocialPostAction} style={{ display: "grid", gap: 20 }}>
          <label style={fieldStyle}>
            <strong>Internal title</strong>
            <input style={inputStyle} name="title" required maxLength={160} placeholder="e.g. Why your leads stop responding" />
          </label>

          <label style={fieldStyle}>
            <strong>Caption / post copy</strong>
            <textarea style={{ ...inputStyle, minHeight: 180, resize: "vertical" }} name="caption" maxLength={6000} placeholder="Write the first draft here." />
          </label>

          <label style={fieldStyle}>
            <strong>Format</strong>
            <select style={inputStyle} name="format" defaultValue="carousel">
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="carousel">Carousel</option>
              <option value="video">Video</option>
              <option value="reel">Reel</option>
              <option value="story">Story</option>
            </select>
          </label>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 10 }}>
            <legend style={{ fontWeight: 700, marginBottom: 8 }}>Publish to</legend>
            <label><input type="checkbox" name="platforms" value="instagram" defaultChecked /> Instagram</label>
            <label><input type="checkbox" name="platforms" value="facebook" /> Facebook (draft planning only)</label>
            <label><input type="checkbox" name="platforms" value="linkedin" /> LinkedIn (draft planning only)</label>
            <small>Only Instagram is currently supported for scheduling and live publishing. Facebook and LinkedIn drafts cannot be published through this workflow yet.</small>
          </fieldset>

          <div>
            <button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>Create draft</button>
          </div>
        </form>
      </section>
    </main>
  );
}
