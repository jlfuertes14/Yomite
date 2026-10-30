  const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');
const https = require('https');

const config = getDefaultConfig(__dirname);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchUpstream(parsedTarget, method, headers, bodyBuffer, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error('Too many redirects in proxy'));
    }

    const client = parsedTarget.protocol === 'https:' ? https : http;
    const reqHeaders = { ...headers };

    if (bodyBuffer && bodyBuffer.length > 0) {
      reqHeaders['Content-Length'] = bodyBuffer.length;
    }

    const options = {
      protocol: parsedTarget.protocol,
      hostname: parsedTarget.hostname,
      port: parsedTarget.port || (parsedTarget.protocol === 'https:' ? 443 : 80),
      path: parsedTarget.pathname + parsedTarget.search,
      method,
      headers: reqHeaders,
      timeout: 15000,
    };

    const upstreamReq = client.request(options, (upstreamRes) => {
      // Check for redirects (301, 302, 303, 307, 308)
      const statusCode = upstreamRes.statusCode || 200;
      if ([301, 302, 303, 307, 308].includes(statusCode) && upstreamRes.headers.location) {
        const nextTarget = new URL(upstreamRes.headers.location, parsedTarget);
        // On 303, change method to GET and clear body
        const nextMethod = statusCode === 303 ? 'GET' : method;
        const nextBody = statusCode === 303 ? null : bodyBuffer;
        upstreamRes.resume(); // Discard redirect response body
        return resolve(fetchUpstream(nextTarget, nextMethod, headers, nextBody, redirectCount + 1));
      }

      resolve({ upstreamRes, upstreamReq });
    });

    upstreamReq.on('error', reject);
    upstreamReq.on('timeout', () => {
      upstreamReq.destroy(new Error('Proxy request timed out'));
    });

    if (bodyBuffer && bodyBuffer.length > 0 && method !== 'GET' && method !== 'HEAD') {
      upstreamReq.write(bodyBuffer);
    }
    upstreamReq.end();
  });
}

async function handleProxy(req, res, targetUrl, referer) {
  try {
    const parsedTarget = new URL(targetUrl);

    // Read incoming body buffer only for mutating methods
    let bodyBuffer = null;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : null;
    }

    const headers = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
    };

    if (referer) {
      headers['Referer'] = referer;
    }
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    const { upstreamRes } = await fetchUpstream(
      parsedTarget,
      req.method,
      headers,
      bodyBuffer
    );

    const contentType = upstreamRes.headers['content-type'] || '';
    const isImage = contentType.startsWith('image/');
    const upstreamStatus = upstreamRes.statusCode || 200;
    const finalStatus = (!isImage && upstreamStatus >= 400) ? 200 : upstreamStatus;

    const resHeaders = {
      ...CORS_HEADERS,
      'x-upstream-status': String(upstreamStatus),
    };
    if (contentType) {
      resHeaders['Content-Type'] = contentType;
    }

    res.writeHead(finalStatus, resHeaders);
    upstreamRes.pipe(res);
  } catch (err) {
    res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy request failed', message: err.message }));
  }
}

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost:8081'}`);

      if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
      }

      if (url.pathname === '/api/proxy') {
        const target = url.searchParams.get('url');
        const referer = req.headers['x-proxy-referer'] || url.searchParams.get('referer');
        if (!target) {
          res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing target url parameter' }));
          return;
        }
        handleProxy(req, res, target, referer);
        return;
      }

      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
