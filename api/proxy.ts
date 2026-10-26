export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const reqUrl = new URL(req.url);
  const target = reqUrl.searchParams.get('url');

  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing target url parameter' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    return new Response(JSON.stringify({ error: 'Invalid URL protocol. Must be http or https.' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const referer =
    req.headers.get('x-proxy-referer') ||
    reqUrl.searchParams.get('referer') ||
    undefined;

  const upstreamHeaders: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    Accept: req.headers.get('accept') || '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  if (referer) {
    upstreamHeaders['Referer'] = referer;
  }

  const contentType = req.headers.get('content-type');
  if (contentType) {
    upstreamHeaders['Content-Type'] = contentType;
  }

  try {
    let body: BodyInit | undefined = undefined;
    if (req.method === 'POST') {
      body = await req.arrayBuffer();
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers: upstreamHeaders,
      body,
    });

    const responseHeaders = new Headers();
    for (const [key, val] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(key, val);
    }

    const upstreamContentType = upstream.headers.get('content-type') || '';
    if (upstreamContentType) {
      responseHeaders.set('Content-Type', upstreamContentType);
    }

    responseHeaders.set('x-upstream-status', String(upstream.status));

    // Cache successful GET responses briefly
    if (req.method === 'GET' && upstream.status === 200) {
      responseHeaders.set(
        'Cache-Control',
        'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
      );
    }

    const isImage = upstreamContentType.startsWith('image/');
    const finalStatus = (!isImage && upstream.status >= 400) ? 200 : upstream.status;

    return new Response(upstream.body, {
      status: finalStatus,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'Proxy request failed',
        message: err?.message || String(err),
      }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
}
