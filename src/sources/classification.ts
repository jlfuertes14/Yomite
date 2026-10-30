/**
 * Source and Manga Classification Registry
 *
 * Classifies extensions, aggregator sources, and manga titles into:
 * - 'manhwa': Korean Manhwa, Chinese Manhua, Webtoons (Vertical scrolling, Long Strip)
 * - 'manga': Traditional Japanese Manga & Doujinshi (Paginated, Single/RTL/LTR)
 * - 'mixed': Hosts both Manga and Manhwa (e.g. MangaDex, MangaFire, Manganato)
 *
 * Indexed from EverythingMoe (https://everythingmoe.com/) directory curation
 * and Kotatsu/Yomite source specifications.
 */

import type { ReadingMode } from '../types';

export type SourceClassification = 'manhwa' | 'manga' | 'mixed';

/**
 * Sources dedicated exclusively or primarily to Korean Manhwa, Chinese Manhua,
 * and vertical scrolling webtoons (EverythingMoe Manhwa Reading category).
 */
export const MANHWA_EXCLUSIVE_SOURCES = new Set<string>([
  'asurascans',
  'asuracomic',
  'asura',
  'flamecomics',
  'flamescans',
  'flame',
  'omegascans',
  'omega',
  'vortexscans',
  'iken',
  'hivetoon',
  'hivescans',
  'hivetoons',
  'hive',
  'philiascans',
  'philia',
  'toonily',
  'toonily-net',
  'toonz',
  'toonkotsu',
  'templescan',
  'templescans',
  'projectsuki',
  'manhuafast',
  'topmanhua',
  'mangatx',
  'ravenscans',
  'raven',
  'webtoonxyz',
  'reaperscans',
  'reaper',
  'manhwatop',
  'cosmicscans',
  'voidscans',
  'void',
  'astrascans',
  'resetscans',
  'nightcomic',
  'surfaceteam',
  'realmscans',
  'rizzfables',
  'zeroscans',
  'aquamanga',
  'skymanga',
  '1stkissmanga',
  '1stkiss',
  'coffeemanga',
  'manhuaus',
  'manhwaclan',
  'zinmanga',
  'kunmanga',
  'manga18fx',
  'manhwa18',
  'manhwatrend',
  'manhwaweb',
  'hiperdex',
  'manhwahentai',
  'webtoons',
  'naver',
  'tapas',
  'tappytoon',
  'lezhin',
  'toomics',
  'manta',
  'bilibilicomics',
  'kuaikan',
  'manhuaplus',
  'manhuascan',
]);

/**
 * Sources dedicated exclusively or primarily to Japanese Manga & Doujinshi
 * (EverythingMoe Manga Reading category - paginated Right-to-Left / Left-to-Right).
 */
export const MANGA_EXCLUSIVE_SOURCES = new Set<string>([
  'mangapill',
  'weebcentral',
  'reimanga',
  'onisaga',
  'mangaball',
  'atsumaru',
  'atsu',
  'mangak',
  'mangak.io',
  'hitomila',
  'hitomi',
  'nhentai',
  'mangareader',
  'mangakatana',
  'mangaeden',
  'senmanga',
  'rawkuma',
  'klmanga',
  'mangaowl',
  'dynasty',
  'dynastyreader',
  'bato',
  'tmo',
  'guya',
  'catmanga',
]);

/**
 * Sources that aggregate both Japanese Manga and Korean Manhwa / Webtoons.
 * These require tag or metadata inspection to determine reading mode.
 */
export const MIXED_SOURCES = new Set<string>([
  'mangadex',
  'comick-fun',
  'comick',
  'mangafire',
  'manganato',
  'chapmanganato',
  'natomanga',
  'mangakakalot',
  'mangago',
  'mangadot',
  'comix-to',
  'kagane',
]);

/**
 * Tag keywords that reliably indicate a vertical Long Strip / Webtoon.
 */
export const MANHWA_WEBTOON_TAG_KEYWORDS = [
  'long strip',
  'long-strip',
  'longstrip',
  'webtoon',
  'web-toon',
  'web comic',
  'webcomic',
  'web-comic',
  'manhwa',
  'manhua',
  'full color',
  'full-color',
  'vertical',
  'scroll',
];

/**
 * MangaDex tag IDs that map directly to Webtoon / Long Strip format.
 */
export const MANGADEX_WEBTOON_TAG_IDS = new Set<string>([
  '3e2b8dae-350e-4ab8-a8ce-016e844b9f0d', // Long Strip
  'e197df38-d0e7-43b5-9b09-2842d0c326dd', // Web Comic
  'f5ba408b-0e7a-484d-8d49-aa038075ba15', // Full Color
]);

/**
 * Korean language codes indicating Manhwa
 */
export const KOREAN_LANGUAGES = new Set(['ko', 'kr', 'kor', 'korean']);

/**
 * Chinese language codes indicating Manhua
 */
export const CHINESE_LANGUAGES = new Set(['zh', 'zh-hk', 'zh-ro', 'cn', 'chi', 'chinese']);

/**
 * Japanese language codes indicating Manga
 */
export const JAPANESE_LANGUAGES = new Set(['ja', 'jp', 'jpn', 'japanese']);

/**
 * Extracts a normalized source ID from a chapter ID, manga ID, or URL.
 * e.g. "asurascans:chapter-1" -> "asurascans"
 *      "mangadex:3e2b8dae-..." -> "mangadex"
 *      "https://toonily.com/..." -> "toonily"
 */
export function extractSourceId(sourceIdOrUrl: string): string {
  if (!sourceIdOrUrl) return 'mangadex';
  const clean = sourceIdOrUrl.trim().toLowerCase();

  if (clean.startsWith('mangadex:')) return 'mangadex';
  const colonIndex = clean.indexOf(':');
  if (colonIndex > 0) {
    const candidate = clean.substring(0, colonIndex);
    // Ensure it's not a protocol like http/https
    if (candidate !== 'http' && candidate !== 'https') {
      return candidate;
    }
  }

  // Domain / keyword matchers
  if (clean.includes('asuracomic') || clean.includes('asurascans')) return 'asurascans';
  if (clean.includes('flamecomics') || clean.includes('flamescans')) return 'flamecomics';
  if (clean.includes('omegascans')) return 'omegascans';
  if (clean.includes('vortexscans')) return 'vortexscans';
  if (clean.includes('hivetoon') || clean.includes('hivescans')) return 'hivetoon';
  if (clean.includes('philiascans')) return 'philiascans';
  if (clean.includes('toonily')) return 'toonily';
  if (clean.includes('toonz')) return 'toonz';
  if (clean.includes('toonkotsu')) return 'toonkotsu';
  if (clean.includes('templescan')) return 'templescan';
  if (clean.includes('projectsuki')) return 'projectsuki';
  if (clean.includes('mangapill')) return 'mangapill';
  if (clean.includes('weebcentral')) return 'weebcentral';
  if (clean.includes('reimanga')) return 'reimanga';
  if (clean.includes('onisaga')) return 'onisaga';
  if (clean.includes('mangaball')) return 'mangaball';
  if (clean.includes('atsu.moe') || clean.includes('atsumaru')) return 'atsumaru';
  if (clean.includes('mangak.io') || clean.includes('mangak')) return 'mangak';
  if (clean.includes('hitomi')) return 'hitomila';
  if (clean.includes('nhentai')) return 'nhentai';
  if (clean.includes('mangareader')) return 'mangareader';
  if (clean.includes('comick')) return 'comick-fun';
  if (clean.includes('mangafire')) return 'mangafire';
  if (clean.includes('manganato')) return 'manganato';
  if (clean.includes('mangakakalot')) return 'mangakakalot';
  if (clean.includes('mangadot')) return 'mangadot';
  if (clean.includes('comix.to') || clean.includes('comixto')) return 'comix-to';
  if (clean.includes('kagane')) return 'kagane';
  if (clean.includes('ravenscans')) return 'ravenscans';

  // MangaDex UUID format
  const isMangaDexUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(clean);
  if (isMangaDexUuid) return 'mangadex';

  return clean;
}

/**
 * Classifies a source as exclusively 'manhwa', exclusively 'manga', or 'mixed'.
 */
export function classifySource(sourceIdOrUrl: string): SourceClassification {
  const sourceId = extractSourceId(sourceIdOrUrl);

  if (MANHWA_EXCLUSIVE_SOURCES.has(sourceId)) {
    return 'manhwa';
  }
  if (MANGA_EXCLUSIVE_SOURCES.has(sourceId)) {
    return 'manga';
  }
  if (MIXED_SOURCES.has(sourceId)) {
    return 'mixed';
  }

  // Fallback heuristic based on name patterns
  if (/manhwa|webtoon|manhua|toon|strip|scroll/i.test(sourceId)) {
    return 'manhwa';
  }

  return 'mixed';
}

export interface ReadingModeDetectionParams {
  sourceId?: string;
  originalLanguage?: string;
  tags?: Array<string | { id?: string; attributes?: { name?: Record<string, string>; group?: string } }>;
  title?: string;
  url?: string;
}

/**
 * Detects the recommended default reading mode ('webtoon' vs 'single')
 * using source extension classification and manga metadata/tags.
 *
 * Returns null only when the source and metadata are completely inconclusive,
 * allowing fallback to sampled image dimensions.
 */
export function detectReadingModeFromMetadata(params: ReadingModeDetectionParams): ReadingMode | null {
  const { sourceId, originalLanguage, tags, title, url } = params;
  const sourceHint = `${sourceId || ''} ${url || ''}`.trim();
  const sourceClass = sourceHint ? classifySource(sourceHint) : 'mixed';

  // 1. Exclusive Source Overrides:
  // If the extension exclusively hosts Manhwa / Webtoons (e.g. AsuraScans, OmegaScans, Flame, Toonily),
  // always switch to webtoon mode immediately.
  if (sourceClass === 'manhwa') {
    return 'webtoon';
  }

  // If the extension exclusively hosts Japanese Manga / Doujinshi (e.g. MangaPill, WeebCentral, ReiManga),
  // default to single page.
  if (sourceClass === 'manga') {
    return 'single';
  }

  // 2. Normalized Tag Inspection (Crucial for mixed sources like MangaDex, MangaFire, Manganato):
  if (Array.isArray(tags) && tags.length > 0) {
    for (const t of tags) {
      if (!t) continue;

      // Check MangaDex specific Tag UUIDs
      if (typeof t === 'object' && t.id && MANGADEX_WEBTOON_TAG_IDS.has(t.id)) {
        return 'webtoon';
      }

      // Check tag text label
      const tagLabel =
        typeof t === 'string'
          ? t
          : t.attributes?.name?.en || t.attributes?.name?.['ja-ro'] || (t as any).name || (t as any).label || '';
      const normalizedTag = tagLabel.toLowerCase().trim();

      if (MANHWA_WEBTOON_TAG_KEYWORDS.some((kw) => normalizedTag.includes(kw))) {
        return 'webtoon';
      }
    }
  }

  // 3. Original Language Inspection:
  // Korean (ko/kr) titles are almost universally Manhwa webtoons.
  // Chinese (zh/cn) titles are almost universally Manhua webtoons.
  if (originalLanguage) {
    const lang = originalLanguage.toLowerCase().trim();
    if (KOREAN_LANGUAGES.has(lang)) {
      return 'webtoon';
    }
    if (CHINESE_LANGUAGES.has(lang)) {
      return 'webtoon';
    }
    if (JAPANESE_LANGUAGES.has(lang)) {
      // Japanese manga is standard paginated by default
      return 'single';
    }
  }

  // 4. Title & URL Slug Keywords:
  const contentHint = `${title || ''} ${url || ''}`.toLowerCase();
  if (/\b(?:manhwa|webtoon|web-toon|manhua|longstrip)\b/i.test(contentHint)) {
    return 'webtoon';
  }

  return null;
}

/**
 * Resolves the accurate contentType for a catalog item or source metadata:
 * 'manhwa' | 'manga' | 'comic' | 'hentai'
 */
export function getSourceContentType(source: {
  id?: string;
  name?: string;
  title?: string;
  domain?: string;
  contentType?: string;
}): 'manhwa' | 'manga' | 'comic' | 'hentai' {
  if (!source) return 'manga';

  const sourceId = extractSourceId(source.id || source.domain || '');

  // 1. If explicitly in manhwa exclusive sources list:
  if (MANHWA_EXCLUSIVE_SOURCES.has(sourceId)) {
    return 'manhwa';
  }

  // 2. If explicitly in manga exclusive sources list:
  if (MANGA_EXCLUSIVE_SOURCES.has(sourceId)) {
    return 'manga';
  }

  // 3. If adult / hentai source:
  if (source.contentType === 'hentai' || sourceId === 'nhentai' || sourceId === 'hitomila') {
    if (/manhwa|webtoon|toon/i.test(`${source.id || ''} ${source.name || ''} ${source.title || ''}`)) {
      return 'manhwa';
    }
    return 'hentai';
  }

  // 4. Pattern heuristics for manhwa / webtoon aggregator sites
  const hint = `${source.id || ''} ${source.name || ''} ${source.title || ''} ${source.domain || ''}`.toLowerCase();
  if (
    /\b(?:manhwa|webtoon|web-toon|manhua|toons?|strip|scroll)\b/i.test(hint) ||
    hint.includes('asura') ||
    hint.includes('flame') ||
    hint.includes('omega') ||
    hint.includes('toonily') ||
    hint.includes('reaper') ||
    hint.includes('vortex') ||
    hint.includes('philia') ||
    hint.includes('hivetoon') ||
    hint.includes('hivescans') ||
    hint.includes('toonkotsu') ||
    hint.includes('toonz') ||
    hint.includes('templescan') ||
    hint.includes('projectsuki') ||
    hint.includes('manhuafast') ||
    hint.includes('topmanhua') ||
    hint.includes('mangatx') ||
    hint.includes('ravenscans') ||
    hint.includes('webtoonxyz') ||
    hint.includes('cosmicscans') ||
    hint.includes('voidscans') ||
    hint.includes('astrascans') ||
    hint.includes('resetscans') ||
    hint.includes('realmscans') ||
    hint.includes('rizzfables') ||
    hint.includes('aquamanga') ||
    hint.includes('zinmanga') ||
    hint.includes('kunmanga') ||
    hint.includes('coffeemanga') ||
    hint.includes('1stkiss') ||
    hint.includes('manhuaus') ||
    hint.includes('manhwaclan') ||
    hint.includes('hiperdex') ||
    hint.includes('manhwatop')
  ) {
    return 'manhwa';
  }

  // 5. Western Comics
  if (
    source.contentType === 'comic' ||
    sourceId === 'comix-to' ||
    hint.includes('comicextra') ||
    hint.includes('readallcomics')
  ) {
    return 'comic';
  }

  return 'manga';
}
