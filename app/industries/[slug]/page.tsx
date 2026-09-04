import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IndustryDetailPage from "@/components/industry/IndustryDetailPage";
import { industries, industryBySlug } from "@/lib/industryCatalog";
import { withIndustryPhase4Overrides } from "@/lib/industryPhase4Overrides";
import { withIndustryPhase5Overrides } from "@/lib/industryPhase5Overrides";
import { withIndustryPhase6Overrides } from "@/lib/industryPhase6Overrides";

function resolveIndustry(slug: string) {
  const baseIndustry = industryBySlug[slug];
  return baseIndustry
    ? withIndustryPhase6Overrides(withIndustryPhase5Overrides(withIndustryPhase4Overrides(baseIndustry)))
    : undefined;
}

export function generateStaticParams() {
  return industries.map((industry) => ({ slug: industry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const industry = resolveIndustry(slug);

  if (!industry) {
    return { title: "Industry | Fluxknight" };
  }

  return {
    title: `${industry.name} AI Automation | Fluxknight`,
    description: industry.subhead,
    openGraph: {
      title: `${industry.name} AI Automation | Fluxknight`,
      description: industry.subhead,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${industry.name} AI Automation | Fluxknight`,
      description: industry.subhead,
    },
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = resolveIndustry(slug);

  if (!industry) notFound();

  return <IndustryDetailPage industry={industry} />;
}
