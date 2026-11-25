import { projectsIn, streams } from "@zainlabs/content";
import { corsHeaders } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  return Response.json(streams.map((s) => ({ ...s, projectCount: projectsIn(s.slug).length })), { headers: corsHeaders });
}
