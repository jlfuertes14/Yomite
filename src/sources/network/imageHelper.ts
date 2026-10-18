import { DEFAULT_USER_AGENT, sourceHttpClient } from './httpClient';

/**
 * Converts a Uint8Array into a base64 string safely across Node, Hermes, and browsers.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return typeof btoa !== 'undefined' ? btoa(binary) : '';
}

/**
 * Fetches an image buffer via HTTP and formats it as an inline Base64 Data URI.
 * Critical for CDNs (like Kagane/kstatic) that name JPEG payloads with `.jxl`
 * which native image decoders (Glide / CoreGraphics / expo-image) reject.
 */
export async function fetchBufferAsDataUri(
  url: string,
  headers?: Record<string, string>
): Promise<string | null> {
  try {
    let targetUrl = url;
    if (targetUrl && !targetUrl.startsWith('http') && !targetUrl.startsWith('data:')) {
      if (targetUrl.startsWith('/api/media/') || targetUrl.includes('philia')) {
        targetUrl = `https://philiascans.org/${targetUrl.replace(/^\/+/, '')}`;
      }
    }

    const reqHeaders: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      ...headers,
    };

    if (targetUrl.includes('kstatic.to') || targetUrl.includes('kagane.moe')) {
      reqHeaders['Referer'] = 'https://kagane.moe/';
    } else if (targetUrl.includes('philiascans.org')) {
      reqHeaders['Referer'] = 'https://philiascans.org/';
    }

    const buf = await sourceHttpClient.fetchBuffer(targetUrl, {
      headers: reqHeaders,
      silent: true,
    });

    if (!buf || buf.byteLength === 0) return null;

    const bytes = new Uint8Array(buf);
    let mime = 'image/jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      mime = 'image/png';
    } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      mime = 'image/webp';
    }

    const b64 = bytesToBase64(bytes);
    return b64 ? `data:${mime};base64,${b64}` : null;
  } catch {
    return null;
  }
}
