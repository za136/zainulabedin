export type StreamSlug = "software" | "web" | "apps" | "studio" | "deeptech";

export type ProjectStatus = "Concept" | "PRD" | "In development" | "MVP" | "Live" | "Released";

export interface Stream {
  slug: StreamSlug;
  code: string; // factory code from Factory HQ, e.g. F1
  name: string;
  tagline: string;
  description: string;
  capabilities: string[];
}

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  slug: string;
  code?: string; // P01, P02 ... from the Factory HQ tracker
  title: string;
  stream: StreamSlug;
  status: ProjectStatus;
  year: number;
  summary: string; // one sentence, shown on cards
  description: string[]; // paragraphs, shown on the detail page
  highlights: string[];
  stack: string[];
  links: ProjectLink[];
  featured?: boolean;
}

export interface Site {
  name: string;
  claim: string;
  intro: string;
  location: string;
  email: string;
  process: { title: string; text: string }[];
}
