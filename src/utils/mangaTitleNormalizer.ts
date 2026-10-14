/**
 * Manga Title Normalizer & Cross-Source Deduplication Utility
 * Provides robust title normalization and history entry deduplication
 * across different sources (MangaDex, AsuraScans, Manganato, Flame Comics, etc.).
 */
import type { HistoryEntry } from '../types';

/** Common release and quality tags enclosed in brackets or parentheses */
const NOISE_TAGS_REGEX =
  /\s*[\(\[\{]\s*(?:official(?:\s+(?:english|translation|colored?|digital|version|release))?|colored?|full\s+color|digital(?:\s+colored?)?|webtoon|manhwa|manhua|manga|raw|english|en|uncensored|serialized|pre-serialization|remake|complete|ongoing|scan(?:lation)?|tapas|bilibili|tappytoon|line\s+webtoon|web\s*comic|comic|hd|hq|batch)\s*[\)\]\}]/gi;

/** Characters to normalize or replace */
const UNICODE_APOSTROPHES = /[\u2018\u2019\u02BC\u02BB\u0060\u00B4]/g; // ‘ ’ ʼ ʻ ` ´
const UNICODE_QUOTES = /[\u201C\u201D\u00AB\u00BB]/g; // “ ” « »
const UNICODE_DASHES = /[\u2013\u2014\u2015\u2212\u30FC]/g; // – — ― − ー
const MULTIPLICATION_SIGNS = /[\u00D7\u2715\u2716]/g; // × ✕ ✖

/**
 * Normalizes a manga title for comparison:
 * 1. Decomposes Unicode diacritics (e.g. Pok\u00e9mon -> Pokemon)
 * 2. Unifies quotes, apostrophes, dashes, and cross symbols
 * 3. Strips known noise tags like (Official), [Colored], (Webtoon), etc.
 * 4. Collapses whitespace and lowercases
 */
export function normalizeMangaTitle(title: string): string {
  if (!title || typeof title !== 'string') return '';

  let normalized = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(UNICODE_APOSTROPHES, "'")
    .replace(UNICODE_QUOTES, '"')
    .replace(UNICODE_DASHES, '-')
    .replace(MULTIPLICATION_SIGNS, 'x');

  // Strip known noise tags
  normalized = normalized.replace(NOISE_TAGS_REGEX, '');

  // Strip leading/trailing non-alphanumeric noise (e.g. dots, hyphens, tildes)
  normalized = normalized.replace(/^[\s\-_~:!?.…*•]+|[\s\-_~:!?.…*•]+$/g, '');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim().toLowerCase();

  return normalized;
}

/**
 * Compact alphanumeric representation (strips all punctuation and spaces)
 */
export function toAlphaNumericKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Strips all brackets/parentheses and their inner content
 */
function stripAllBracketedContent(title: string): string {
  return title.replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').trim();
}

/**
 * Checks if two manga titles represent the exact same manga series across sources.
 */
export function areTitlesSameManga(titleA: string, titleB: string): boolean {
  if (!titleA || !titleB) return false;

  const rawA = titleA.trim();
  const rawB = titleB.trim();

  // 1. Direct case-insensitive match
  if (rawA.toLowerCase() === rawB.toLowerCase()) {
    return true;
  }

  // 2. Normalized title match (stripping known release tags and normalizing typography)
  const normA = normalizeMangaTitle(rawA);
  const normB = normalizeMangaTitle(rawB);

  if (normA && normB && normA === normB) {
    return true;
  }

  // 3. Compact alphanumeric match (ignores hyphens vs spaces, e.g. "Chainsaw-Man" vs "Chainsaw Man")
  const alphaA = toAlphaNumericKey(normA);
  const alphaB = toAlphaNumericKey(normB);

  if (alphaA.length >= 3 && alphaA === alphaB) {
    return true;
  }

  // 4. Bracket-stripped fallback (e.g. "Solo Leveling [Random Scanlation]" vs "Solo Leveling")
  const strippedA = stripAllBracketedContent(rawA);
  const strippedB = stripAllBracketedContent(rawB);

  if (strippedA && strippedB) {
    const alphaStrippedA = toAlphaNumericKey(normalizeMangaTitle(strippedA));
    const alphaStrippedB = toAlphaNumericKey(normalizeMangaTitle(strippedB));

    // Avoid false positives on sequels or seasons if enclosed in brackets
    const hasSequelTagA = /\b(?:season|part|vol|volume|sequel|ragnarok|\d+(?:st|nd|rd|th))\b/i.test(rawA);
    const hasSequelTagB = /\b(?:season|part|vol|volume|sequel|ragnarok|\d+(?:st|nd|rd|th))\b/i.test(rawB);

    if (hasSequelTagA === hasSequelTagB && alphaStrippedA.length >= 3 && alphaStrippedA === alphaStrippedB) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if two HistoryEntry objects belong to the same manga
 */
export function isSameMangaHistoryEntry(a: HistoryEntry, b: HistoryEntry): boolean {
  if (!a || !b) return false;

  // 1. Same exact mangaId
  if (a.mangaId && b.mangaId && a.mangaId === b.mangaId) {
    return true;
  }

  // 2. Same chapterId (fallback)
  if (a.chapterId && b.chapterId && a.chapterId === b.chapterId) {
    return true;
  }

  // 3. Match by normalized title across different source IDs
  if (a.title && b.title && areTitlesSameManga(a.title, b.title)) {
    return true;
  }

  return false;
}

/**
 * Merges two HistoryEntry instances for the same manga:
 * Keeps the newest reading progress, newest chapter, latest timestamp,
 * and falls back to whichever coverUrl is non-null.
 */
export function mergeHistoryEntries(primary: HistoryEntry, secondary: HistoryEntry): HistoryEntry {
  const isPrimaryNewer = (primary.timestamp || 0) >= (secondary.timestamp || 0);
  const newest = isPrimaryNewer ? primary : secondary;
  const oldest = isPrimaryNewer ? secondary : primary;

  return {
    ...newest,
    // Preserve coverUrl from older if newest is missing one
    coverUrl: newest.coverUrl || oldest.coverUrl || null,
    // Preserve scrollOffset if available
    scrollOffset: newest.scrollOffset ?? oldest.scrollOffset,
  };
}

/**
 * Deduplicates a list of HistoryEntry items so that only ONE card exists per manga series.
 * Preserves the newest read chapter and timestamp, and returns the list sorted descending by timestamp.
 */
export function deduplicateHistoryEntries(entries: HistoryEntry[]): HistoryEntry[] {
  if (!entries || entries.length <= 1) {
    return entries ? [...entries] : [];
  }

  const result: HistoryEntry[] = [];

  for (const entry of entries) {
    if (!entry) continue;

    const existingIndex = result.findIndex((existing) => isSameMangaHistoryEntry(existing, entry));

    if (existingIndex === -1) {
      result.push({ ...entry });
    } else {
      // Merge with the existing entry to preserve the latest progress and best cover
      result[existingIndex] = mergeHistoryEntries(result[existingIndex], entry);
    }
  }

  // Sort by timestamp descending so the most recently read manga is at the top
  result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return result;
}
