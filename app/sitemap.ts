import type { MetadataRoute } from "next";
import { industries } from "@/lib/industryCatalog";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://fluxknight.space";
  const serviceSlugs = [
    "ai-sales-agent",
    "ai-customer-support",
    "whatsapp",
    "telegram",
    "voice",
    "crm",
    "lead-generation",
    "calendar-email",
    "email-follow-up",
  ];

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/services`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/industries`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/pricing`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/evaluation`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/case-studies`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/case-studies/maia`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/contact`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/faq`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.7 },
  ];

  const servicePages: MetadataRoute.Sitemap = serviceSlugs.map((slug) => ({
    url: `${baseUrl}/services/${slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const industryPages: MetadataRoute.Sitemap = industries.map((industry) => ({
    url: `${baseUrl}/industries/${industry.slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticPages, ...servicePages, ...industryPages];
}
