import Link from "next/link";
import BrandFilmPlayer from "./BrandFilmPlayer";
import styles from "./BrandFilmSection.module.css";

/**
 * Use a publicly streamable HTTPS URL (for example a managed video CDN), not a
 * sandbox download URL. Keep the section off until the master film is hosted.
 */
function getBrandFilmSource(): string | null {
  const candidate = process.env.NEXT_PUBLIC_FLUXKNIGHT_BRAND_FILM_URL?.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? candidate : null;
  } catch {
    return null;
  }
}

function getCaptionsSource(): string | undefined {
  const candidate = process.env.NEXT_PUBLIC_FLUXKNIGHT_BRAND_FILM_CAPTIONS_URL?.trim();
  if (!candidate) return undefined;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? candidate : undefined;
  } catch {
    return undefined;
  }
}

export default function BrandFilmSection() {
  const src = getBrandFilmSource();
  if (!src) return null;

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
        <BrandFilmPlayer
          src={src}
          captionsSrc={getCaptionsSource()}
          poster="/opengraph-image"
        />
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
