import { projects } from "@zainlabs/content";
import { corsHeaders } from "@/lib/site";

export function GET(request: Request) {
  const stream = new URL(request.url).searchParams.get("stream");
  return Response.json(stream ? projects.filter((p) => p.stream === stream) : projects, { headers: corsHeaders });
}
