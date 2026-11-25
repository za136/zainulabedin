export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const statusClass = (status: string) =>
  ({ MVP: "st-mvp", Live: "st-live", Released: "st-live", "In development": "st-dev", PRD: "st-plan", Concept: "st-plan" })[
    status
  ] ?? "st-plan";

/** CORS for the public read API and contact endpoint (mobile app on web, other front ends). */
export const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
