import type { MetadataRoute } from "next";
import { listPublishedSlugs } from "@/lib/db";

const SITE_URL = "https://lamboapp.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/docs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  ];

  const deals = await listPublishedSlugs(5000).catch(() => []);
  const dealRoutes: MetadataRoute.Sitemap = deals.map((d) => ({
    url: `${SITE_URL}/deal/${d.slug}`,
    lastModified: d.published_at ? new Date(d.published_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...dealRoutes];
}
