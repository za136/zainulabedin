import type { Site } from "./types";

export const site: Site = {
  name: "ZAIN LABS",
  claim: "Engineering agentic AI, apps and media for DACH.",
  intro:
    "One studio, five production lines. We turn researched ideas into working software, websites, mobile apps, films and music for businesses and audiences in Germany, Austria and Switzerland.",
  location: "Germany · Austria · Switzerland",
  email: "hello@zainlabs.example",
  process: [
    { title: "Research", text: "Every product starts from a researched brief, not a hunch: market, users, regulation in DACH." },
    { title: "Specification", text: "A written PRD with decisions, assumptions and open questions before the first line of code." },
    { title: "Build", text: "Shared templates, agents and CI let each new product start at 60% instead of zero." },
    { title: "Evaluate", text: "Tests, golden cases and human review gates. Nothing consequential happens without approval." },
    { title: "Launch", text: "Shipped as a public demo, website, app or release, with metrics fed back into the next build." },
  ],
};
