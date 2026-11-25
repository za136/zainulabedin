import type { Stream } from "./types";

export const streams: Stream[] = [
  {
    slug: "software",
    code: "F1",
    name: "Software",
    tagline: "Agentic AI products",
    description:
      "A reusable pipeline that turns researched ideas into PRDs and then into working agentic-AI products for DACH businesses: multi-agent workflows, ERP-connected automations, APIs and dashboards.",
    capabilities: ["Agentic workflows", "ERP connectors (Odoo, ERPNext)", "Evaluation harnesses", "Human-in-the-loop approval"],
  },
  {
    slug: "web",
    code: "F2",
    name: "Websites",
    tagline: "3D, SEO and AI-search ready",
    description:
      "One generator for modern showroom and e-commerce sites: shared design system, content model and deploy pipeline, so a new product gets a site in a day.",
    capabilities: ["Design systems", "3D product viewers", "SEO & AI-search optimisation", "Static and e-commerce sites"],
  },
  {
    slug: "apps",
    code: "F3",
    name: "Mobile Apps",
    tagline: "iOS and Android from one codebase",
    description:
      "Cross-platform apps that reuse the website design system and the software back ends: navigation, auth, theming, offline cache and store release pipeline included.",
    capabilities: ["Expo / React Native", "Offline-first content", "Media and 3D modules", "EAS build & submit"],
  },
  {
    slug: "studio",
    code: "F4",
    name: "Studio",
    tagline: "Film, music and channel content",
    description:
      "A mostly automated, Linux-based studio toolbox for micro dramas, songs, albums and channel content for DACH audiences, from idea to script, storyboard, edit and release.",
    capabilities: ["Script → storyboard → shot list", "AI-assisted music production", "Render & edit presets", "Release kits"],
  },
  {
    slug: "deeptech",
    code: "F5",
    name: "Deep-Tech",
    tagline: "Engineering intelligence & research",
    description:
      "Long-horizon research and engineering intelligence across manufacturing, maintenance, supply chain, CAD and imaging, plus the market research behind every other stream.",
    capabilities: ["Engineering intelligence", "Decision & assumption ledgers", "DACH ecosystem research", "Prototype experiments"],
  },
];
