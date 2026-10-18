/**
 * BridgedImage — Universal resilient image component with automatic
 * Cloudflare bypass & WebView bridge fallback for MangaDot and protected CDNs.
 */
import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Platform } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import {
  webViewBridge,
  imageBridgeCache,
  isCloudflareProtectedUrl,
} from '../sources/network/webViewBridge';
import { fetchBufferAsDataUri } from '../sources/network/imageHelper';

function getDefaultHeadersForUri(uri: string): Record<string, string> | undefined {
  if (!uri || typeof uri !== 'string') return undefined;
  const lower = uri.toLowerCase();
  const defaultUA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  if (lower.includes('poke-black-and-white.net') || lower.includes('mangaball.com')) {
    return {
      Referer: 'https://mangaball.com/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  if (lower.includes('projectsuki.com')) {
    return {
      Referer: 'https://projectsuki.com/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  if (lower.includes('mangapicgallery.com') || lower.includes('mangago.me')) {
    return {
      Referer: 'https://www.mangago.me/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  if (lower.includes('atsu.moe')) {
    return {
      Referer: 'https://atsu.moe/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  if (lower.includes('philiascans.org')) {
    return {
      Referer: 'https://philiascans.org/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  if (lower.includes('mangafire.to') || lower.includes('mflocdn.com') || lower.includes('mangafire')) {
    return {
      Referer: 'https://mangafire.to/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  if (lower.includes('hitomi.la') || lower.includes('hitomi-la')) {
    return {
      Referer: 'https://hitomi.la/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  if (lower.includes('weebcentral.com') || lower.includes('planeptune.us')) {
    return {
      Referer: 'https://weebcentral.com/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  if (lower.includes('mangak.io') || lower.includes('resmk.org') || lower.includes('qvzr')) {
    return {
      Referer: 'https://mangak.io/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  if (lower.includes('onisaga.com')) {
    return {
      Referer: 'https://onisaga.com/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  if (lower.includes('toonkotsu.com')) {
    return {
      Referer: 'https://toonkotsu.com/',
      'User-Agent': defaultUA,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }
  return undefined;
}


export interface BridgedImageProps extends Omit<ImageProps, 'source'> {
  uri?: string | null;
  headers?: Record<string, string>;
  source?: ImageProps['source'];
}

function BridgedImageComponent({
  uri,
  headers,
  source,
  onError,
  ...restProps
}: BridgedImageProps) {
  // If local require asset (number), render directly
  if (typeof source === 'number') {
    return <Image source={source} onError={onError} {...restProps} />;
  }

  // Extract URI from string, source object, or uri prop
  const sourceObj = typeof source === 'object' && source !== null ? (source as any) : null;
  const rawUri = (typeof source === 'string' ? source : sourceObj?.uri || uri || null) as string | null;

  // Ensure relative media URIs (e.g. PhiliaScans /api/media/...) are resolved to absolute URLs
  const resolvedUri = useMemo(() => {
    if (!rawUri) return null;
    if (rawUri.startsWith('http') || rawUri.startsWith('data:') || rawUri.startsWith('file:')) {
      return rawUri;
    }
    if (rawUri.startsWith('/api/media/') || rawUri.includes('philia')) {
      return `https://philiascans.org/${rawUri.replace(/^\/+/, '')}`;
    }
    return rawUri;
  }, [rawUri]);

  const defaultHeaders = resolvedUri ? getDefaultHeadersForUri(resolvedUri) : undefined;
  const resolvedHeaders = headers || sourceObj?.headers || defaultHeaders;

  const [displayUri, setDisplayUri] = useState<string | null>(() => {
    if (!resolvedUri) return null;
    return imageBridgeCache.get(resolvedUri) || resolvedUri;
  });

  const isBridgingRef = useRef(false);

  useEffect(() => {
    if (!resolvedUri) {
      setDisplayUri(null);
      return;
    }

    // 1. Instant hit from session in-memory cache
    const cached = imageBridgeCache.get(resolvedUri);
    if (cached) {
      setDisplayUri(cached);
      return;
    }

    setDisplayUri(resolvedUri);

    // 2. If Cloudflare protected domain on native Android/iOS, proactively bridge fetch
    if (Platform.OS !== 'web' && isCloudflareProtectedUrl(resolvedUri)) {
      let isMounted = true;
      isBridgingRef.current = true;

      webViewBridge
        .fetchImageBase64(resolvedUri)
        .then((dataUri) => {
          if (isMounted && dataUri) {
            imageBridgeCache.set(resolvedUri, dataUri);
            setDisplayUri(dataUri);
          }
        })
        .catch(() => {
          // If proactive bridge fails, onError will handle fallback
        })
        .finally(() => {
          isBridgingRef.current = false;
        });

      return () => {
        isMounted = false;
      };
    }

    // 3. If JXL / Kagane kstatic image, proactively fetch buffer as data uri
    if (resolvedUri.includes('.jxl') || resolvedUri.includes('kstatic.to')) {
      let isMounted = true;
      fetchBufferAsDataUri(resolvedUri, resolvedHeaders)
        .then((dataUri) => {
          if (isMounted && dataUri) {
            imageBridgeCache.set(resolvedUri, dataUri);
            setDisplayUri(dataUri);
          }
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }
  }, [resolvedUri]);

  const handleError = async (event: any) => {
    // 1. If Cloudflare protected source on native, attempt WebView bridge fetch
    if (
      resolvedUri &&
      Platform.OS !== 'web' &&
      isCloudflareProtectedUrl(resolvedUri) &&
      !displayUri?.startsWith('data:') &&
      webViewBridge.hasSender()
    ) {
      try {
        const dataUri = await webViewBridge.fetchImageBase64(resolvedUri);
        if (dataUri) {
          imageBridgeCache.set(resolvedUri, dataUri);
          setDisplayUri(dataUri);
          return;
        }
      } catch {
        // Bridge also failed, fallback to direct buffer fetch
      }
    }

    // 2. Resilient direct HTTP buffer fetch for any image that failed in native decoder
    if (
      resolvedUri &&
      !displayUri?.startsWith('data:')
    ) {
      try {
        const dataUri = await fetchBufferAsDataUri(resolvedUri, resolvedHeaders);
        if (dataUri) {
          imageBridgeCache.set(resolvedUri, dataUri);
          setDisplayUri(dataUri);
          return;
        }
      } catch {}
    }

    onError?.(event);
  };

  if (!displayUri) {
    return null;
  }

  const finalSource = displayUri.startsWith('data:')
    ? { uri: displayUri }
    : resolvedHeaders && Platform.OS !== 'web'
    ? { uri: displayUri, headers: resolvedHeaders }
    : { uri: displayUri };

  return (
    <Image
      {...restProps}
      source={finalSource}
      onError={handleError}
    />
  );
}

export const BridgedImage = memo(BridgedImageComponent);
