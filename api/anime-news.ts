export const config = {
  runtime: 'edge',
};

const FEED_URLS = [
  'https://www.animenewsnetwork.com/news/rss.xml?ann-edition=us',
  'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us',
  'https://www.animenewsnetwork.com/all/rss.xml',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=900, s-maxage=900, stale-while-revalidate=3600',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  for (const feedUrl of FEED_URLS) {
    try {
      const upstream = await fetch(feedUrl, {
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml',
          'User-Agent': 'Yomite/1.0 (https://yomite.vercel.app)',
        },
      });

      if (!upstream.ok) continue;

      return new Response(upstream.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': upstream.headers.get('content-type') || 'application/rss+xml; charset=utf-8',
        },
      });
    } catch {
      // Try the next ANN feed variant.
    }
  }

  return new Response('Anime News Network feed unavailable', {
    status: 502,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
