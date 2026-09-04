import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: {
      default: "Fluxknight Service",
      template: "%s",
    },
    alternates: { canonical: `/services/${slug}` },
    openGraph: { url: `/services/${slug}` },
  };
}

export default function ServiceDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
