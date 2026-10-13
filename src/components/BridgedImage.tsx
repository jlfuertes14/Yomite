/**
 * BridgedImage — Universal resilient image component with automatic
 * Cloudflare bypass & WebView bridge fallback for MangaDot and protected CDNs.
 */
import React, { useState, useEffect, useRef, memo } from 'react';
import { Platform } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import {
  webViewBridge,
  imageBridgeCache,
  isCloudflareProtectedUrl,
} from '../sources/network/webViewBridge';

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

  // Extract URI from source object or uri prop
  const sourceObj = typeof source === 'object' && source !== null ? (source as any) : null;
  const resolvedUri = (sourceObj?.uri || uri || null) as string | null;
  const resolvedHeaders = headers || sourceObj?.headers || undefined;

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
  }, [resolvedUri]);

  const handleError = async (event: any) => {
    // If native load failed with 403 or network error, attempt WebView bridge fetch
    if (
      resolvedUri &&
      Platform.OS !== 'web' &&
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
        // Bridge also failed, allow onError to fire
      }
    }

    onError?.(event);
  };

  if (!displayUri) {
    return null;
  }

  const finalSource = displayUri.startsWith('data:')
    ? { uri: displayUri }
    : resolvedHeaders
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
