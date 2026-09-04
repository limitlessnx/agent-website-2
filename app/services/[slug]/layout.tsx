import type { Metadata } from "next";

const serviceDescription =
  "Explore a Fluxknight AI automation service built around faster response, stronger follow-up, connected customer operations, and clear human handoff.";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const path = `/services/${slug}`;

  return {
    title: {
      default: "Fluxknight Service",
      template: "%s",
    },
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: "Fluxknight",
      title: "Fluxknight AI Automation Service",
      description: serviceDescription,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Fluxknight AI automation service" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Fluxknight AI Automation Service",
      description: serviceDescription,
      images: ["/twitter-image"],
    },
  };
}

export default function ServiceDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
