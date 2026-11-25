import type { MetadataRoute } from "next";
import { projects, streams } from "@zainlabs/content";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/projects",
    "/contact",
    "/newsletter",
    ...streams.map((s) => `/streams/${s.slug}`),
    ...projects.map((p) => `/projects/${p.slug}`),
  ].map((path) => ({ url: `${SITE_URL}${path}` }));
}
