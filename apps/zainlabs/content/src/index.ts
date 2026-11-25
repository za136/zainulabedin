import { projects } from "./projects";
import { site } from "./site";
import { streams } from "./streams";
import type { Project, Stream, StreamSlug } from "./types";

export * from "./types";
export { projects, site, streams };

export const getStream = (slug: string): Stream | undefined => streams.find((s) => s.slug === slug);
export const getProject = (slug: string): Project | undefined => projects.find((p) => p.slug === slug);
export const projectsIn = (stream: StreamSlug): Project[] => projects.filter((p) => p.stream === stream);
export const featuredProjects = (): Project[] => projects.filter((p) => p.featured);

export const stats = () => ({
  streams: streams.length,
  projects: projects.length,
  shipped: projects.filter((p) => ["MVP", "Live", "Released"].includes(p.status)).length,
});

/** Everything a client needs in one payload (served at /api/content, bundled in the app as fallback). */
export const contentBundle = () => ({ version: 1, site, streams, projects });
export type ContentBundle = ReturnType<typeof contentBundle>;
