import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/login", "/register"],
      },
    ],
    sitemap: "https://fluxknight.ai/sitemap.xml",
    host: "https://fluxknight.ai",
  };
}
