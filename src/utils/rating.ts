/**
 * rating.ts — Universal Manga Rating Normalizer
 * 
 * Standardizes diverse rating scoring systems across all manga catalogs/parsers
 * into a single unified 10-point scale matching MangaDex (e.g., 8.4 / 10).
 */

export function normalizeRatingToTen(
  rawRating: number | null | undefined,
  sourceId?: string
): number | null {
  if (rawRating == null || isNaN(rawRating) || rawRating <= 0) {
    return null;
  }

  let normalized = rawRating;

  // 1. 100-point percentage scale (e.g. 85 / 100 -> 8.5)
  if (normalized > 10) {
    normalized = normalized / 10;
  }
  // 2. 5-star rating scale on external aggregators (e.g. Manganato / Madara 4.5 / 5 -> 9.0)
  // MangaDex is already calibrated out of 10, so exclude mangadex from 5-star multiplication
  else if (normalized <= 5.0 && sourceId !== 'mangadex' && normalized > 0) {
    normalized = normalized * 2;
  }

  // Clamp between 0.1 and 10.0
  const clamped = Math.min(10.0, Math.max(0.1, normalized));
  return Math.round(clamped * 10) / 10;
}
