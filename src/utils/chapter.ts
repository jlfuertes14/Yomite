/**
 * Chapter utilities — Parse numbers, compute unread counts and read progress percentages
 */

/**
 * Extracts a chapter number from a title string or chapter ID.
 * Examples:
 * - "Ch. 5" -> 5
 * - "Chapter 12.5 - Extra" -> 12.5
 * - "Episode 7" -> 7
 * - "mangadot:solo-leveling__chapter-15" -> 15
 * - "ch-23" -> 23
 */
export function parseChapterNumber(text?: string | null): number | null {
  if (!text) return null;
  const str = String(text).trim();
  if (!str) return null;

  // 1. Explicit chapter/ch/ep/episode prefixes
  const chMatch = str.match(/(?:chapter|ch\.?|ep\.?|episode)[_\s-]*([\d.]+)/i);
  if (chMatch) {
    const val = parseFloat(chMatch[1]);
    if (!isNaN(val)) return val;
  }

  // 2. URL or ID pattern with chapter separator
  const idMatch = str.match(/(?:chapter[/:_-]|:|\/|-|^)([\d.]+)(?:$|[/?#_-])/i);
  if (idMatch) {
    const val = parseFloat(idMatch[1]);
    if (!isNaN(val)) return val;
  }

  // 3. Fallback: match standalone decimal number
  const numMatch = str.match(/\b([\d.]+)\b/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    if (!isNaN(val)) return val;
  }

  return null;
}

/**
 * Calculates the number of unread chapters remaining.
 */
export function calculateUnreadCount(
  totalChapters: number,
  lastReadChNum?: number | null,
  isCompleted?: boolean
): number {
  if (isCompleted || totalChapters <= 0) return 0;
  if (lastReadChNum !== null && lastReadChNum !== undefined && lastReadChNum > 0) {
    const read = Math.min(totalChapters, Math.floor(lastReadChNum));
    return Math.max(0, totalChapters - read);
  }
  return totalChapters;
}

/**
 * Calculates reading progress percentage (0 - 100).
 */
export function calculateReadPercent(
  totalChapters: number,
  readCount: number,
  isCompleted?: boolean
): number {
  if (isCompleted) return 100;
  if (totalChapters <= 0 || readCount <= 0) return 0;
  const pct = Math.round((readCount / totalChapters) * 100);
  return Math.min(100, Math.max(readCount > 0 ? 8 : 0, pct));
}
