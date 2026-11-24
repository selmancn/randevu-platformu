type Env = { ORACLE: { fetch(request: Request): Promise<Response> } };

export default {
  async fetch(request: Request, env: Env) {
    const origin = new URL(request.url);
    const publicHost = 'randevu-platformu.selman-cinn.workers.dev';
    if (origin.hostname !== publicHost) return new Response('Not found', { status: 404 });
    if (origin.protocol !== 'https:') {
      origin.protocol = 'https:';
      return Response.redirect(origin, 308);
    }
    origin.protocol = 'http:';
    const headers = new Headers(request.headers);
    headers.set('Host', publicHost);
    headers.set('X-Forwarded-Host', publicHost);
    headers.set('X-Forwarded-Proto', 'https');
    headers.delete('Forwarded');
    headers.delete('X-Forwarded-For');
    try {
      const upstream = await env.ORACLE.fetch(new Request(origin, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      }));
      const outgoing = new Headers(upstream.headers);
      outgoing.set('Strict-Transport-Security', 'max-age=86400');
      if (!origin.pathname.startsWith('/_next/static/')) outgoing.set('Cache-Control', 'private, no-store');
      return new Response(upstream.body, { status: upstream.status, headers: outgoing });
    } catch {
      return new Response('Uygulamaya şu anda ulaşılamıyor.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  },
};
