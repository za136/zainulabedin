import { cookies } from 'next/headers';
import { API_URL, SESSION_COOKIE } from '@/lib/api';

/** Invoice proxy: forwards the httpOnly session (or guest order token) to the API. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get('token');
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  const res = await fetch(`${API_URL}/v1/orders/${encodeURIComponent(id)}/invoice${token ? `?token=${encodeURIComponent(token)}` : ''}`, {
    headers: session ? { authorization: `Bearer ${session}` } : {},
    cache: 'no-store',
  });
  return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'text/html', 'cache-control': 'private, no-store' } });
}
