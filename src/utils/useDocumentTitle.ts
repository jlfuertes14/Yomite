import { useEffect } from 'react';
import { Platform } from 'react-native';

export const DEFAULT_APP_TITLE = 'Yomite — Free Modern Manga & Comic Reader';

/**
 * Dynamically updates the browser tab title on web platforms.
 * Safe to call on native platforms (no-op).
 */
export function setDocumentTitle(title?: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.title = title ? `${title} — Yomite` : DEFAULT_APP_TITLE;
  }
}

/**
 * React hook to set the document title when a component / page is mounted.
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = title ? `${title} — Yomite` : DEFAULT_APP_TITLE;
    }
  }, [title]);
}
