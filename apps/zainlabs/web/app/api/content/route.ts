import { contentBundle } from "@zainlabs/content";
import { corsHeaders } from "@/lib/site";

export const dynamic = "force-static";

/** Everything in one payload: the mobile app syncs from here. */
export function GET() {
  return Response.json(contentBundle(), { headers: { ...corsHeaders, "Cache-Control": "public, max-age=300" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
