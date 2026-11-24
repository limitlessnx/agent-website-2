import Link from "next/link";
import BrandFilmPlayer from "./BrandFilmPlayer";
import styles from "./BrandFilmSection.module.css";

/**
 * The commercial is hosted on YouTube rather than our application storage.
 * Use an 11-character YouTube ID or a canonical watch/share/shorts URL.
 * The approved official Fluxknight video is now public; use it as a safe default.
 */
function getYouTubeVideoId(): string | null {
  const candidate = process.env.NEXT_PUBLIC_FLUXKNIGHT_BRAND_FILM_YOUTUBE_URL?.trim() || "UMdJ9zZ3fos";
  if (!candidate) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(candidate)) return candidate;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") return null;

    const host = parsed.hostname.toLowerCase();
    let videoId: string | null = null;

    if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com" || host === "www.youtube-nocookie.com") {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v");
      } else {
        const match = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})\/?$/);
        videoId = match?.[1] ?? null;
      }
    } else if (host === "youtu.be" || host === "www.youtu.be") {
      videoId = parsed.pathname.match(/^\/([a-zA-Z0-9_-]{11})\/?$/)?.[1] ?? null;
    }

    return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

export default function BrandFilmSection() {
  const videoId = getYouTubeVideoId();
  if (!videoId) return null;

  return (
    <section className={styles.section} id="fluxknight-film" aria-labelledby="fluxknight-film-title">
      <div className={styles.shell}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Fluxknight in action</span>
          <h2 id="fluxknight-film-title">See how Fluxknight connects your entire customer journey.</h2>
          <p>
            From the first enquiry to conversion, customer retention and repeat business.
            See how connected automation works across industries.
          </p>
        </div>
        <BrandFilmPlayer videoId={videoId} />
        <div className={styles.footer}>
          <p>One connected system for conversations, CRM, follow-ups and human oversight.</p>
          <Link href="/industries" className={styles.link} data-cta="brand-film-industries">
            Explore solutions for your industry <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
