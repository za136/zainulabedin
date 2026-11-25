import { getProject } from "@zainlabs/content";
import { corsHeaders } from "@/lib/site";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const p = getProject((await params).slug);
  return p ? Response.json(p, { headers: corsHeaders }) : Response.json({ error: "not found" }, { status: 404, headers: corsHeaders });
}
