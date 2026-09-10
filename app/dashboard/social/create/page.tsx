import Link from "next/link";
import { createSocialPostAction } from "@/app/dashboard/social/actions";

const fieldStyle = { display: "grid", gap: 8 } as const;
const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--admin-border, #2d2d35)", background: "transparent", color: "inherit" } as const;

export default function CreateSocialPostPage() {
  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Social</p>
          <h1>Create post</h1>
          <p>Phase 1 creates controlled drafts. AI generation and media rendering will plug into this same record later.</p>
        </div>
        <Link href="/dashboard/social" className="admin-status">Back to Social</Link>
      </header>

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
