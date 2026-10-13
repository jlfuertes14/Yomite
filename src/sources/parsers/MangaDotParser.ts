/**
 * MangaDot Parser (mangadot.net)
 * Fast REST JSON API client with full search,
 * genre filtering, multi-metric sorting, and direct WebP CDN delivery.
 */
import { BaseParser } from './BaseParser';
import {
  MangaSourceMetadata,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
  SourceSortOption,
  SourceTag,
} from '../types';
import { sourceHttpClient, DEFAULT_USER_AGENT } from '../network/httpClient';
import { CloudFlareCookieManager } from '../network/cloudflare';

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'is',
  'it',
  'by',
  'as',
]);

/**
 * Normalizes title / query strings by stripping accents, punctuation, apostrophes,
 * and normalizing spacing and cross-multiplication symbols.
 */
export function normalizeSearchString(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics / accents
    .replace(/['’`]/g, '')           // remove apostrophes (e.g. Solo's -> solos)
    .replace(/[×✕✖]/g, ' x ')        // normalize cross symbols with spacing (e.g. SPY×FAMILY -> spy x family)
    .replace(/[^a-z0-9\s]/g, ' ')    // replace punctuation with whitespace
    .replace(/\s+/g, ' ')            // collapse multiple spaces
    .trim();
}

/**
 * Computes a title match strength score for a manga item against a search query.
 * Returns:
 * - 1000: Exact match
 * - 600..800: Prefix or word-bounded phrase match
 * - 300..400: Substring or all query tokens present in title
 * - 150: Majority of query tokens present (for queries >= 3 words)
 * - 0: No strong title match (item should be filtered out)
 */
export function computeTitleMatchScore(
  itemOrTitle:
    | string
    | {
        title?: string;
        name?: string;
        slug?: string;
        alt_titles?: string | string[];
        alternative_titles?: string | string[];
        title_alt?: string | string[];
        other_names?: string | string[];
      },
  query: string
): number {
  const qNorm = normalizeSearchString(query);
  if (!qNorm) return 100;

  const rawTokens = qNorm.split(' ').filter(Boolean);
  const meaningfulTokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
  const qTokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

  const candidates: string[] = [];
  if (typeof itemOrTitle === 'string') {
    candidates.push(itemOrTitle);
  } else if (itemOrTitle && typeof itemOrTitle === 'object') {
    if (itemOrTitle.title) candidates.push(itemOrTitle.title);
    if (itemOrTitle.name && itemOrTitle.name !== itemOrTitle.title) candidates.push(itemOrTitle.name);
    if (itemOrTitle.slug) candidates.push(itemOrTitle.slug.replace(/[-_]/g, ' '));

    const checkAlt = (val: any) => {
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string') candidates.push(item);
        }
      } else if (typeof val === 'string') {
        candidates.push(...val.split(/[,;|\n]/));
      }
    };

    checkAlt(itemOrTitle.alt_titles);
    checkAlt(itemOrTitle.alternative_titles);
    checkAlt(itemOrTitle.title_alt);
    checkAlt(itemOrTitle.other_names);
  }

  let maxScore = 0;

  for (const rawCand of candidates) {
    const tNorm = normalizeSearchString(rawCand);
    if (!tNorm) continue;

    let score = 0;
    if (tNorm === qNorm) {
      score = 1000;
    } else if (tNorm.startsWith(qNorm + ' ') || tNorm.startsWith(qNorm)) {
      score = 800 - Math.min(200, Math.max(0, tNorm.length - qNorm.length));
    } else if (
      new RegExp(
        '(^|\\s)' + qNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)'
      ).test(tNorm)
    ) {
      score = 600 - Math.min(200, Math.max(0, tNorm.length - qNorm.length));
    } else if (tNorm.includes(qNorm)) {
      score = 400 - Math.min(100, Math.max(0, tNorm.length - qNorm.length));
    } else {
      const tTokens = new Set(tNorm.split(' ').filter(Boolean));
      const matched = qTokens.filter(
        (qt) => tTokens.has(qt) || [...tTokens].some((tt) => tt.startsWith(qt) || qt.startsWith(tt))
      );

      if (qTokens.length <= 2) {
        if (matched.length === qTokens.length) {
          score = 300 - Math.min(100, Math.max(0, tNorm.length - qNorm.length));
        }
      } else {
        const ratio = matched.length / qTokens.length;
        if (ratio === 1) {
          score = 300 - Math.min(100, Math.max(0, tNorm.length - qNorm.length));
        } else if (ratio >= 0.7) {
          score = 150;
        }
      }
    }

    if (score > maxScore) maxScore = score;
  }

  return maxScore;
}

export class MangaDotParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'mangadot',
      name: 'MangaDot',
      domain: 'mangadot.net',
      baseUrl: 'https://mangadot.net',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://icon.horse/icon/mangadot.net',
      description:
        'Fast and modern manga platform with extensive licensed & scanlated series, high-res WebP pages, and open APIs.',
      availableSortOrders: ['popular', 'latest', 'rating', 'chapters'],
      enabled: true,
      ...metadata,
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Popular / Most Viewed' },
      { id: 'latest', label: 'Latest Updates' },
      { id: 'rating', label: 'Top Rated' },
      { id: 'chapters', label: 'Most Chapters' },
    ];
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'Action', label: 'Action' },
      { id: 'Adventure', label: 'Adventure' },
      { id: 'Comedy', label: 'Comedy' },
      { id: 'Drama', label: 'Drama' },
      { id: 'Fantasy', label: 'Fantasy' },
      { id: 'Horror', label: 'Horror' },
      { id: 'Mystery', label: 'Mystery' },
      { id: 'Romance', label: 'Romance' },
      { id: 'Sci-Fi', label: 'Sci-Fi' },
      { id: 'Slice of Life', label: 'Slice of Life' },
      { id: 'Sports', label: 'Sports' },
      { id: 'Supernatural', label: 'Supernatural' },
      { id: 'Manga', label: 'Manga' },
      { id: 'Manhwa', label: 'Manhwa' },
      { id: 'Manhua', label: 'Manhua' },
      { id: 'Isekai', label: 'Isekai' },
      { id: 'Psychological', label: 'Psychological' },
      { id: 'Thriller', label: 'Thriller' },
      { id: 'Tragedy', label: 'Tragedy' },
    ];
  }

  private normalizeCoverUrl(photo: string | null | undefined): string | null {
    if (!photo || typeof photo !== 'string') return null;
    let clean = photo.trim();
    if (!clean) return null;
    if (clean.startsWith('//')) {
      clean = `https:${clean}`;
    } else if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `${this.metadata.baseUrl}/${clean.replace(/^\/+/, '')}`;
    }
    if (clean.startsWith('http://')) {
      clean = clean.replace('http://', 'https://');
    }
    return clean;
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const params = new URLSearchParams();
    params.set('page', String(page));

    // 1. Text Search Query
    const hasQuery = typeof filter.query === 'string' && filter.query.trim().length > 0;
    const cleanQuery = hasQuery ? filter.query!.trim() : '';
    if (hasQuery) {
      params.set('search', cleanQuery);
    }

    // 2. Genre / Tag Filtering
    if (filter.tags && filter.tags.length > 0) {
      params.set('genres', filter.tags[0]);
    }

    // 3. Sort & Order Handling
    switch (filter.order) {
      case 'latest':
        params.set('sortBy', 'updated_at');
        params.set('sortOrder', 'desc');
        break;
      case 'rating':
        params.set('sortBy', 'rating');
        params.set('sortOrder', 'desc');
        break;
      case 'chapters':
        params.set('sortBy', 'chapters');
        params.set('sortOrder', 'desc');
        break;
      case 'popular':
      default:
        // When searching by title query, default to relevance unless explicit sort is specified
        if (hasQuery && (!filter.order || filter.order === 'popular')) {
          params.set('sortBy', 'relevance');
        } else {
          params.set('sortBy', 'views');
        }
        params.set('sortOrder', 'desc');
        break;
    }

    const apiUrl = `${this.metadata.baseUrl}/api/search?${params.toString()}`;
    const data = await sourceHttpClient.fetchJson<any>(apiUrl, {
      referer: `${this.metadata.baseUrl}/`,
      sourceId: this.metadata.name,
    });

    const items = Array.isArray(data?.manga_list) ? data.manga_list : [];

    const cfCookie = CloudFlareCookieManager.getCookie(this.metadata.domain);
    const coverHeaders: Record<string, string> = {
      Referer: `${this.metadata.baseUrl}/`,
      'User-Agent': DEFAULT_USER_AGENT,
    };
    if (cfCookie) {
      coverHeaders['Cookie'] = cfCookie;
    }

    // Collect and score items against search query
    const scoredList: { manga: SourceManga; score: number }[] = [];

    for (const item of items) {
      const score = hasQuery ? computeTitleMatchScore(item, cleanQuery) : 100;
      // Filter out cards that do not strongly match the search query in their title
      if (score <= 0) {
        continue;
      }

      const id = String(item.id);
      const url = `${this.metadata.baseUrl}/manga/${id}`;
      const cover = this.normalizeCoverUrl(item.photo);

      const state: SourceManga['state'] =
        item.status?.toLowerCase() === 'completed' ? 'completed' : 'ongoing';

      scoredList.push({
        score,
        manga: {
          id: `${this.metadata.id}:${id}`,
          sourceId: this.metadata.id,
          title: item.title || 'Untitled',
          url,
          publicUrl: url,
          coverUrl: cover,
          coverHeaders,
          rating: typeof item.avg_rating === 'number' ? item.avg_rating : undefined,
          tags: Array.isArray(item.genres) ? item.genres : undefined,
          state,
        },
      });
    }

    // Sort items by match score descending so strongest title matches appear first
    if (hasQuery) {
      scoredList.sort((a, b) => b.score - a.score);
    }

    return scoredList.map((entry) => entry.manga);
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const mangaId = manga.id.includes(':')
      ? manga.id.split(':')[1]
      : manga.url.split('/').pop() || manga.id;
    const apiUrl = `${this.metadata.baseUrl}/api/manga/${mangaId}`;

    const data = await sourceHttpClient.fetchJson<any>(apiUrl, {
      referer: `${this.metadata.baseUrl}/manga/${mangaId}`,
      sourceId: this.metadata.name,
    });

    const m = data?.manga || data || {};
    const cover = this.normalizeCoverUrl(m.photo) || manga.coverUrl;

    const authors: string[] = [];
    if (Array.isArray(m.authors)) {
      authors.push(...m.authors.filter(Boolean));
    } else if (m.author) {
      authors.push(m.author);
    }
    if (Array.isArray(m.artists)) {
      for (const a of m.artists) {
        if (a && !authors.includes(a)) authors.push(a);
      }
    } else if (m.artist && !authors.includes(m.artist)) {
      authors.push(m.artist);
    }

    const state: SourceManga['state'] =
      m.status?.toLowerCase() === 'completed' ? 'completed' : 'ongoing';

    const cfCookie = CloudFlareCookieManager.getCookie(this.metadata.domain);
    const coverHeaders: Record<string, string> = {
      Referer: `${this.metadata.baseUrl}/`,
      'User-Agent': DEFAULT_USER_AGENT,
    };
    if (cfCookie) {
      coverHeaders['Cookie'] = cfCookie;
    }

    return {
      ...manga,
      title: m.title || manga.title,
      coverUrl: cover,
      coverHeaders,
      description: m.description ? this.cleanText(m.description) : manga.description,
      authors: authors.length > 0 ? authors : manga.authors,
      tags: Array.isArray(m.genres) ? m.genres : manga.tags,
      state,
      rating: typeof m.avg_rating === 'number' ? m.avg_rating : manga.rating,
    };
  }

  private extractScanlator(ch: any): string {
    if (!ch || typeof ch !== 'object') return 'MangaDot';

    if (typeof ch.group_name === 'string' && ch.group_name.trim()) {
      return ch.group_name.trim();
    }
    if (typeof ch.scanlation_group === 'string' && ch.scanlation_group.trim()) {
      return ch.scanlation_group.trim();
    }
    if (typeof ch.scanlator === 'string' && ch.scanlator.trim()) {
      return ch.scanlator.trim();
    }
    if (typeof ch.group === 'string' && ch.group.trim()) {
      return ch.group.trim();
    }
    if (
      ch.group &&
      typeof ch.group === 'object' &&
      typeof ch.group.name === 'string' &&
      ch.group.name.trim()
    ) {
      return ch.group.name.trim();
    }
    if (typeof ch.team === 'string' && ch.team.trim()) {
      return ch.team.trim();
    }
    if (typeof ch.source_name === 'string' && ch.source_name.trim()) {
      return ch.source_name.trim();
    }
    if (typeof ch.source_title === 'string' && ch.source_title.trim()) {
      return ch.source_title.trim();
    }

    if (typeof ch.source === 'string' && ch.source.trim()) {
      const s = ch.source.trim();
      const lower = s.toLowerCase();
      const KNOWN_SOURCES: Record<string, string> = {
        asura: 'Asura Scans',
        asurascans: 'Asura Scans',
        flame: 'Flame Comics',
        flamecomics: 'Flame Comics',
        reaper: 'Reaper Scans',
        reaperscans: 'Reaper Scans',
        void: 'Void Scans',
        voidscans: 'Void Scans',
        luminous: 'Luminous Scans',
        luminousscans: 'Luminous Scans',
        nightcomic: 'Night Comic',
        anigliscans: 'Anigli Scans',
        surpass: 'Surpass Scans',
        vortex: 'Vortex Scans',
        vortexscans: 'Vortex Scans',
        drake: 'Drake Scans',
        drakescans: 'Drake Scans',
        cosmic: 'Cosmic Scans',
        cosmicscans: 'Cosmic Scans',
        zeroscans: 'Zero Scans',
        astrascans: 'Astra Scans',
        user: 'User Uploads',
      };
      if (KNOWN_SOURCES[lower]) {
        return KNOWN_SOURCES[lower];
      }
      return s.charAt(0).toUpperCase() + s.slice(1);
    }

    if (typeof ch.uploader === 'string' && ch.uploader.trim()) {
      return `User: ${ch.uploader.trim()}`;
    }

    return 'MangaDot';
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const mangaId = manga.id.includes(':')
      ? manga.id.split(':')[1]
      : manga.url.split('/').pop() || manga.id;
    const apiUrl = `${this.metadata.baseUrl}/api/manga/${mangaId}/chapters/list`;

    const data = await sourceHttpClient.fetchJson<any>(apiUrl, {
      referer: `${this.metadata.baseUrl}/manga/${mangaId}`,
      sourceId: this.metadata.name,
    });

    const rawList: any[] = Array.isArray(data) ? data : data?.chapters || [];
    const chapters: SourceChapter[] = [];

    for (const ch of rawList) {
      const chId = String(ch.id);
      const chSource = ch.source || 'user';
      const chUrl = `${this.metadata.baseUrl}/chapter/${chId}?source=${chSource}`;
      const chNum =
        typeof ch.chapter_number === 'number'
          ? ch.chapter_number
          : this.parseChapterNumber(ch.chapter_title);
      const chName =
        ch.chapter_title && ch.chapter_title.trim().length > 0
          ? ch.chapter_title
          : `Chapter ${chNum}`;

      const dateUpload = ch.date_added ? Date.parse(ch.date_added) || null : null;
      const scanlator = this.extractScanlator(ch);

      chapters.push({
        id: `${this.metadata.id}:${chId}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        url: chUrl,
        name: chName,
        number: chNum,
        dateUpload,
        scanlator,
      });
    }

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const chId = chapter.id.includes(':')
      ? chapter.id.split(':')[1]
      : chapter.url.split('/').pop()?.split('?')[0] || chapter.id;

    // Check if source param exists in url (e.g. ?source=user or ?source=scraper)
    let sourceParam = 'user';
    if (chapter.url && chapter.url.includes('source=')) {
      const match = chapter.url.match(/source=([a-zA-Z0-9_-]+)/);
      if (match) sourceParam = match[1];
    }

    const extractImageUrls = (payload: any): string[] => {
      if (!payload) return [];
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.images)
        ? payload.images
        : Array.isArray(payload.data)
        ? payload.data
        : [];
      const found: string[] = [];
      for (const item of list) {
        if (typeof item === 'string') {
          found.push(item);
        } else if (item && typeof item === 'object') {
          const u = item.url || item.path || item.src || item.image || item.photo;
          if (typeof u === 'string') {
            found.push(u);
          }
        }
      }
      return found;
    };

    let rawPaths: string[] = [];

    // Prioritize endpoints based on sourceParam (/api/uploads/... or /api/chapters/...)
    const endpointsToTry =
      sourceParam === 'user'
        ? [
            `${this.metadata.baseUrl}/api/uploads/${chId}/images`,
            `${this.metadata.baseUrl}/api/chapters/${chId}/images`,
          ]
        : [
            `${this.metadata.baseUrl}/api/chapters/${chId}/images`,
            `${this.metadata.baseUrl}/api/uploads/${chId}/images`,
          ];

    for (const ep of endpointsToTry) {
      if (rawPaths.length > 0) break;
      try {
        const data = await sourceHttpClient.fetchJson<any>(ep, {
          referer: `${this.metadata.baseUrl}/chapter/${chId}`,
          sourceId: this.metadata.name,
        });
        rawPaths = extractImageUrls(data);
        if (data?.manga?.id) {
          chapter.mangaId = `${this.metadata.id}:${data.manga.id}`;
        }
      } catch {}
    }

    // Fallback: Next.js RSC data route
    if (rawPaths.length === 0) {
      try {
        const rscData = await sourceHttpClient.fetchJson<any>(
          `${this.metadata.baseUrl}/chapter/${chId}.data?source=${sourceParam}`,
          {
            referer: `${this.metadata.baseUrl}/chapter/${chId}`,
            sourceId: this.metadata.name,
          }
        );
        if (typeof rscData === 'string') {
          const matches =
            rscData.match(/\/chapters\/[^"'\s\\]+/g) ||
            rscData.match(/\/uploads\/[^"'\s\\]+/g);
          if (matches) {
            rawPaths = matches;
          }
        } else {
          rawPaths = extractImageUrls(rscData);
        }
      } catch {}
    }

    // Fallback: Scrape HTML
    if (rawPaths.length === 0) {
      try {
        const $ = await this.fetchHtml(`${this.metadata.baseUrl}/chapter/${chId}`);
        $('img').each((_, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src') || '';
          if (
            src.includes('/chapters/') ||
            src.includes('/uploads/') ||
            (src.includes('mangadot') &&
              !src.includes('logo') &&
              !src.includes('avatar') &&
              !src.includes('icon'))
          ) {
            rawPaths.push(src);
          }
        });
      } catch {}
    }

    const uniquePaths = [...new Set(rawPaths)];

    // Sort ascending by page number if URLs end with numbering (e.g. 1.webp, 02.jpg)
    uniquePaths.sort((a, b) => {
      const numA = parseInt(a.split('/').pop()?.replace(/\D+/g, '') || '0', 10);
      const numB = parseInt(b.split('/').pop()?.replace(/\D+/g, '') || '0', 10);
      return numA - numB;
    });

    const cfCookie = CloudFlareCookieManager.getCookie(this.metadata.domain);
    const pageHeaders: Record<string, string> = {
      Referer: `${this.metadata.baseUrl}/`,
      'User-Agent': DEFAULT_USER_AGENT,
    };
    if (cfCookie) {
      pageHeaders['Cookie'] = cfCookie;
    }

    const pages: SourcePage[] = [];
    uniquePaths.forEach((path, i) => {
      let fullUrl = path.trim().replace(/\\\//g, '/');
      if (fullUrl.startsWith('//')) {
        fullUrl = `https:${fullUrl}`;
      } else if (fullUrl.startsWith('/')) {
        fullUrl = `${this.metadata.baseUrl}${fullUrl}`;
      } else if (!fullUrl.startsWith('http')) {
        fullUrl = `${this.metadata.baseUrl}/${fullUrl}`;
      }
      if (fullUrl.startsWith('http://')) {
        fullUrl = fullUrl.replace('http://', 'https://');
      }
      pages.push({
        index: i,
        url: fullUrl,
        headers: pageHeaders,
      });
    });

    return pages;
  }
}
