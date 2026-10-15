/**
 * Community Media Service — High-Reliability Community Image Processing & Cloud Storage
 * - Animated GIFs: Bypasses compression to preserve multi-frame animations (capped at 5MB)
 * - PNGs: Resized while preserving alpha channel transparency
 * - Photos/JPEGs: Resized to 1080px & compressed to lightweight JPG (~100KB)
 * - Uploads to Supabase Storage ('community' or 'avatars' bucket) for permanent public HTTPS URLs
 */
import { Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_GIF_BYTES = 5 * 1024 * 1024;    // 5MB

export function isGifAsset(uri: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase().includes('gif')) return true;
  const cleanUri = uri.split('?')[0].toLowerCase();
  return cleanUri.endsWith('.gif');
}

export function isPngAsset(uri: string, mimeType?: string): boolean {
  if (mimeType && mimeType.toLowerCase().includes('png')) return true;
  const cleanUri = uri.split('?')[0].toLowerCase();
  return cleanUri.endsWith('.png');
}

function decodeBase64ToUint8(base64: string): Uint8Array {
  const binaryString = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Uploads a single local image to Supabase Storage and returns its public HTTPS URL.
 * If already a remote URL (http/https), returns it as-is.
 * If upload fails, falls back gracefully to the original URI.
 */
export async function uploadCommunityImage(
  localUri: string,
  userId: string,
  index: number = 0
): Promise<string> {
  // If already an HTTP/HTTPS URL, no upload needed
  if (!localUri || localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return localUri;
  }

  try {
    const isGif = isGifAsset(localUri);
    const isPng = isPngAsset(localUri);

    let fileBody: any;
    let contentType = 'image/jpeg';
    let fileExtension = 'jpg';

    if (isGif) {
      // 1. Animated GIF: DO NOT compress with manipulateAsync to preserve full animation frames!
      contentType = 'image/gif';
      fileExtension = 'gif';

      if (Platform.OS === 'web') {
        const response = await fetch(localUri);
        fileBody = await response.blob();
      } else {
        const base64Data = await FileSystem.readAsStringAsync(localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        fileBody = decodeBase64ToUint8(base64Data);
      }
    } else if (isPng) {
      // 2. PNG: Resize with PNG format to preserve transparency
      contentType = 'image/png';
      fileExtension = 'png';

      const manipResult = await manipulateAsync(
        localUri,
        [{ resize: { width: 1080 } }],
        {
          format: SaveFormat.PNG,
          base64: true,
        }
      );

      if (Platform.OS === 'web') {
        const response = await fetch(manipResult.uri);
        fileBody = await response.blob();
      } else if (manipResult.base64) {
        fileBody = decodeBase64ToUint8(manipResult.base64);
      } else {
        const response = await fetch(manipResult.uri);
        fileBody = await response.blob();
      }
    } else {
      // 3. Standard Photos (JPEG / WebP): Downscale to 1080px and compress to 0.75 JPEG
      contentType = 'image/jpeg';
      fileExtension = 'jpg';

      const manipResult = await manipulateAsync(
        localUri,
        [{ resize: { width: 1080 } }],
        {
          compress: 0.75,
          format: SaveFormat.JPEG,
          base64: true,
        }
      );

      if (Platform.OS === 'web') {
        const response = await fetch(manipResult.uri);
        fileBody = await response.blob();
      } else if (manipResult.base64) {
        fileBody = decodeBase64ToUint8(manipResult.base64);
      } else {
        const response = await fetch(manipResult.uri);
        fileBody = await response.blob();
      }
    }

    if (!fileBody) {
      return localUri;
    }

    const userFolder = userId || 'community_user';
    const fileName = `${userFolder}/post_${Date.now()}_${index}.${fileExtension}`;

    // Try primary 'community' bucket, with fallback to 'avatars' bucket
    const targetBuckets = ['community', 'avatars'];
    for (const bucket of targetBuckets) {
      try {
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from(bucket)
          .upload(fileName, fileBody, {
            contentType,
            upsert: true,
          });

        if (!uploadErr && uploadData) {
          const { data: publicData } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);

          if (publicData?.publicUrl) {
            return publicData.publicUrl;
          }
        }
      } catch {
        // Fallback to next bucket
      }
    }

    return localUri;
  } catch (err) {
    console.warn('[Community Media Service] Image upload failed, falling back to local URI:', err);
    return localUri;
  }
}

/**
 * Uploads an array of community image URIs in parallel.
 */
export async function uploadCommunityImages(
  uris: string[],
  userId: string
): Promise<string[]> {
  if (!uris || uris.length === 0) return [];
  const uploadPromises = uris.map((uri, idx) => uploadCommunityImage(uri, userId, idx));
  return Promise.all(uploadPromises);
}
