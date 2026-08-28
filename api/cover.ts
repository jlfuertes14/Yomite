export const config = {
  runtime: 'edge',
};

/**
 * Vercel Edge Function — High Performance MangaDex Cover Art Proxy
 * 
 * Bypasses MangaDex CDN anti-hotlinking by:
 * 1. Stripping incoming browser Referer headers
 * 2. Sending a verified User-Agent header
 * 3. Caching cover images on Vercel Edge CDN for 7 days (s-maxage=604800)
 * 4. Supplying Access-Control-Allow-Origin: * for canvas exports
 */
export default async function handler(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get('path');

  if (!path) {
    return new Response('Missing cover path parameter', { status: 400 });
  }

  // Clean path
  const cleanPath = path.replace(/^\/+/, '');
  const targetUrl = `https://uploads.mangadex.org/covers/${cleanPath}`;

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Yomite/1.2.1 (https://yomite.vercel.app)',
      },
    });

    if (!upstream.ok) {
      return new Response('Cover not found', { status: upstream.status });
    }

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    headers.set(
      'Cache-Control',
      'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
    );
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (err) {
    return new Response('Failed to proxy cover image', { status: 500 });
  }
}
