import Link from "next/link";
import { createSocialPostAction, generateWeeklySocialPlanAction } from "@/app/dashboard/social/actions";

const fieldStyle = { display: "grid", gap: 8 } as const;
const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--admin-border, #2d2d35)", background: "transparent", color: "inherit" } as const;

export default function CreateSocialPostPage() {
  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social</p>
          <h1>Create content</h1>
          <p>Create one controlled draft or let the Phase 3.1 Content Brain build the next five-post weekly plan from the Brand Brain.</p>
        </div>
        <Link href="/dashboard/social" className="admin-status">Back to Social</Link>
      </header>

      <section className="admin-panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <p className="admin-kicker">Phase 3.1</p>
            <h2 style={{ marginTop: 4 }}>AI Content Brain</h2>
            <p style={{ maxWidth: 760 }}>
              Reads the active Fluxknight Brand Brain and creates one weekly strategy plus exactly five review-ready post drafts with hooks, captions, CTAs, formats, platforms and creative briefs.
            </p>
          </div>
          <form action={generateWeeklySocialPlanAction}>
            <button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>
              Generate this week&apos;s 5 posts
            </button>
          </form>
          <small style={{ opacity: 0.7 }}>Generation is idempotent per brand/week, so repeated clicks will not create duplicate weekly plans.</small>
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
            <label><input type="checkbox" name="platforms" value="facebook" defaultChecked /> Facebook</label>
            <label><input type="checkbox" name="platforms" value="linkedin" defaultChecked /> LinkedIn</label>
          </fieldset>

          <div>
            <button type="submit" className="admin-status live" style={{ cursor: "pointer" }}>Create draft</button>
          </div>
        </form>
      </section>
    </main>
  );
}
