import { storeContact, validateContact } from "@/lib/contact";
import { corsHeaders } from "@/lib/site";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = validateContact(body);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400, headers: corsHeaders });
  if (result.value.website) return Response.json({ ok: true }, { headers: corsHeaders }); // honeypot: pretend success
  const id = await storeContact(result.value);
  return Response.json({ ok: true, id }, { status: 201, headers: corsHeaders });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
