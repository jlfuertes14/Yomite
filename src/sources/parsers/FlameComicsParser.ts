/**
 * Flame Comics Parser (Flame Scans)
 * Scrapes official Next.js REST API & embedded __NEXT_DATA__ payloads from flamecomics.xyz.
 * Provides high-speed catalog listing, in-memory search, full chapter trees, and direct CDN WebP readers.
 */
import { BaseParser } from './BaseParser';
import {
  MangaSourceMetadata,
  MangaState,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
  SourceSortOption,
  SourceTag,
} from '../types';
import { sourceHttpClient, DEFAULT_USER_AGENT } from '../network/httpClient';

interface FlameSeriesItem {
  id: number;
  label: string;
  status: string;
  image: string;
  chapter_count?: string;
  categories: string[];
  likes?: number;
  popularityRank?: number;
  last_edit?: number;
  time?: number;
}

export class FlameComicsParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;
  private readonly domain = 'flamecomics.xyz';
  private readonly baseUrl = 'https://flamecomics.xyz';
  private readonly cdnBase = 'https://cdn.flamecomics.xyz';

  // In-memory catalog cache (~45 KB)
  private cachedCatalog: FlameSeriesItem[] | null = null;
  private lastCatalogFetch = 0;
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'flamecomics',
      name: 'Flame Comics',
      domain: this.domain,
      baseUrl: this.baseUrl,
      locale: 'en',
      isNsfw: false,
      version: '1.1.0',
      icon: 'https://www.google.com/s2/favicons?domain=flamecomics.xyz&sz=64',
      description:
        'Official Flame Comics scanlations featuring popular manhwa, leveling action, and fantasy series.',
      availableSortOrders: ['popular', 'latest', 'alphabetical'],
      enabled: true,
      ...metadata,
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Updates' },
      { id: 'alphabetical', label: 'A to Z' },
    ];
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: `${this.baseUrl}/`,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    const catalog = await this.getSeriesCatalog();
    const tagSet = new Set<string>();

    catalog.forEach((item) => {
      (item.categories || []).forEach((c) => {
        if (c && c.trim()) tagSet.add(c.trim());
      });
    });

    if (tagSet.size === 0) {
      // Fallback genres if catalog hasn't populated yet
      [
        'Action',
        'Adventure',
        'Fantasy',
        'Murim',
        'Martial Arts',
        'Reincarnation',
        'Time Travel',
        'Leveling',
        'Shounen',
        'Comedy',
        'School Life',
        'Supernatural',
        'Mystery',
        'Harem',
      ].forEach((t) => tagSet.add(t));
    }

    return Array.from(tagSet)
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({
        id: tag,
        label: tag,
        group: 'Genre',
      }));
  }

  /**
   * Fetches or retrieves cached series list from /browse or /api/series
   */
  private async getSeriesCatalog(): Promise<FlameSeriesItem[]> {
    const now = Date.now();
    if (this.cachedCatalog && now - this.lastCatalogFetch < this.cacheTtlMs) {
      return this.cachedCatalog;
    }

    // 1. Try Next.js __NEXT_DATA__ on /browse for rich metadata (categories, rankings, covers)
    try {
      const html = await sourceHttpClient.fetchText(`${this.baseUrl}/browse`, {
        sourceId: this.metadata.id,
        referer: `${this.baseUrl}/`,
        headers: this.getRequestHeaders(),
      });

      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (nextDataMatch) {
        const json = JSON.parse(nextDataMatch[1]);
        const seriesList: any[] = json.props?.pageProps?.series || [];
        if (Array.isArray(seriesList) && seriesList.length > 0) {
          this.cachedCatalog = seriesList.map((s) => ({
            id: s.series_id || s.id,
            label: s.title || s.label || 'Untitled',
            status: s.status || 'Ongoing',
            image: s.cover || s.image || 'thumbnail.webp',
            categories: Array.isArray(s.categories) ? s.categories : [],
            likes: typeof s.likes === 'number' ? s.likes : 0,
            popularityRank: typeof s.popularityRank === 'number' ? s.popularityRank : 999,
            last_edit: s.last_edit,
            time: s.time,
          }));
          this.lastCatalogFetch = now;
          return this.cachedCatalog;
        }
      }
    } catch (err) {
      console.warn('[FlameComicsParser] /browse parse failed, falling back to /api/series:', err);
    }

    // 2. Fallback to /api/series
    try {
      const data = await sourceHttpClient.fetchJson<any[]>(`${this.baseUrl}/api/series`, {
        sourceId: this.metadata.id,
        referer: `${this.baseUrl}/`,
        headers: this.getRequestHeaders(),
      });

      if (Array.isArray(data) && data.length > 0) {
        this.cachedCatalog = data.map((item) => ({
          id: item.id,
          label: item.label,
          status: item.status,
          image: item.image || 'thumbnail.webp',
          chapter_count: item.chapter_count,
          categories: [],
        }));
        this.lastCatalogFetch = now;
        return this.cachedCatalog;
      }
    } catch (err) {
      console.warn('[FlameComicsParser] Failed to fetch /api/series:', err);
    }

    return this.cachedCatalog || [];
  }

  private parseState(status: string | undefined): MangaState {
    if (!status) return 'unknown';
    const s = status.toLowerCase();
    if (s.includes('ongoing')) return 'ongoing';
    if (s.includes('complete')) return 'completed';
    if (s.includes('hiatus')) return 'hiatus';
    if (s.includes('drop') || s.includes('cancel')) return 'cancelled';
    return 'unknown';
  }

  /**
   * 1. Get List / Search / Genre Filter
   */
  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const all = await this.getSeriesCatalog();
    if (!all.length) return [];

    let filtered = [...all];

    // Filter by genre pills
    const selectedTags = filter.tags || filter.includedTags;
    if (selectedTags && selectedTags.length > 0) {
      const targetTags = selectedTags.map((t) => t.toLowerCase().trim());
      filtered = filtered.filter((s) => {
        if (!s.categories || s.categories.length === 0) return true;
        return s.categories.some((c) => targetTags.includes(c.toLowerCase().trim()));
      });
    }

    // Search query filter
    if (filter.query && filter.query.trim()) {
      const q = filter.query.toLowerCase().trim();
      filtered = filtered.filter((s) => (s.label || '').toLowerCase().includes(q));
    }

    // Sort order
    if (filter.order === 'alphabetical') {
      filtered.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    } else if (filter.order === 'latest') {
      filtered.sort((a, b) => (b.last_edit || b.time || 0) - (a.last_edit || a.time || 0));
    } else {
      // 'popular' or default: sort by popularityRank ascending (1 is top) and likes descending
      filtered.sort((a, b) => {
        const rankA = typeof a.popularityRank === 'number' && a.popularityRank > 0 ? a.popularityRank : 999;
        const rankB = typeof b.popularityRank === 'number' && b.popularityRank > 0 ? b.popularityRank : 999;
        if (rankA !== rankB) return rankA - rankB;
        return (b.likes || 0) - (a.likes || 0);
      });
    }

    // Pagination (24 items per page)
    const page = Math.max(1, filter.page || 1);
    const pageSize = 24;
    const start = (page - 1) * pageSize;
    const pageSlice = filtered.slice(start, start + pageSize);

    return pageSlice.map((item) => {
      const cleanTitle = this.cleanText(item.label || 'Untitled');
      const coverUrl = `${this.cdnBase}/uploads/images/series/${item.id}/${item.image || 'thumbnail.webp'}`;

      return {
        id: `${this.metadata.id}:${item.id}`,
        sourceId: this.metadata.id,
        title: cleanTitle,
        url: `/series/${item.id}`,
        publicUrl: `${this.baseUrl}/series/${item.id}`,
        coverUrl,
        coverHeaders: {
          'User-Agent': DEFAULT_USER_AGENT,
          Referer: `${this.baseUrl}/`,
        },
        state: this.parseState(item.status),
        tags: item.categories,
        chaptersCount: item.chapter_count ? parseInt(item.chapter_count, 10) : undefined,
      };
    });
  }

  /**
   * 2. Get Details
   */
  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const seriesId = manga.id.replace(`${this.metadata.id}:`, '').trim();
    const url = `${this.baseUrl}/series/${seriesId}`;

    try {
      const html = await sourceHttpClient.fetchText(url, {
        sourceId: this.metadata.id,
        referer: `${this.baseUrl}/`,
        headers: this.getRequestHeaders(),
      });

      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (nextDataMatch) {
        const json = JSON.parse(nextDataMatch[1]);
        const s = json.props?.pageProps?.series;
        if (s) {
          const tags: string[] = Array.isArray(s.tags)
            ? s.tags.map((t: any) => this.cleanText(t)).filter(Boolean)
            : manga.tags || [];
          const authors: string[] = Array.isArray(s.author)
            ? s.author.map((a: any) => this.cleanText(a)).filter(Boolean)
            : typeof s.author === 'string' && s.author.trim()
            ? [this.cleanText(s.author)]
            : manga.authors || [];
          const artists: string[] = Array.isArray(s.artist)
            ? s.artist.map((a: any) => this.cleanText(a)).filter(Boolean)
            : typeof s.artist === 'string' && s.artist.trim()
            ? [this.cleanText(s.artist)]
            : manga.artists || [];

          // Keep valid working coverUrl, fallback to thumbnail.webp (never 404 .jpg)
          const catalogItem = this.cachedCatalog?.find((item) => String(item.id) === String(seriesId));
          const coverFilename = catalogItem?.image || 'thumbnail.webp';
          const coverUrl =
            manga.coverUrl && !manga.coverUrl.endsWith('.jpg')
              ? manga.coverUrl
              : `${this.cdnBase}/uploads/images/series/${seriesId}/${coverFilename}`;

          return {
            ...manga,
            title: s.title ? this.cleanText(s.title) : manga.title,
            description: s.description ? this.stripHtml(s.description) : manga.description,
            authors: authors.length ? authors : manga.authors,
            artists: artists.length ? artists : manga.artists,
            tags: tags.length ? tags : manga.tags,
            state: this.parseState(s.status) || manga.state,
            coverUrl,
            coverHeaders: {
              'User-Agent': DEFAULT_USER_AGENT,
              Referer: `${this.baseUrl}/`,
            },
          };
        }
      }
    } catch (err) {
      console.warn(`[FlameComicsParser] getDetails failed for ${seriesId}:`, err);
    }

    return manga;
  }

  /**
   * 3. Get Chapters
   */
  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const seriesId = manga.id.replace(`${this.metadata.id}:`, '').trim();
    const url = `${this.baseUrl}/series/${seriesId}`;

    try {
      const html = await sourceHttpClient.fetchText(url, {
        sourceId: this.metadata.id,
        referer: `${this.baseUrl}/`,
        headers: this.getRequestHeaders(),
      });

      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (!nextDataMatch) return [];

      const json = JSON.parse(nextDataMatch[1]);
      const rawChapters: any[] = json.props?.pageProps?.chapters || [];

      return rawChapters.map((ch) => {
        const token = ch.token || String(ch.chapter_id);
        const chNumber = parseFloat(ch.chapter) || 0;
        const name = ch.title
          ? `Chapter ${ch.chapter} - ${this.cleanText(ch.title)}`
          : `Chapter ${ch.chapter}`;

        return {
          id: `${this.metadata.id}:${seriesId}:${token}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name,
          number: chNumber,
          url: `/series/${seriesId}/${token}`,
          scanlator: 'Flame Comics',
          dateUpload: ch.release_date ? ch.release_date * 1000 : undefined,
        };
      });
    } catch (err) {
      console.error(`[FlameComicsParser] getChapters failed for ${seriesId}:`, err);
      return [];
    }
  }

  /**
   * 4. Get Pages
   */
  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    // chapter.id is in format flamecomics:${seriesId}:${token}
    const parts = chapter.id.split(':');
    const seriesId = parts[1];
    const token = parts[2];
    const url = `${this.baseUrl}/series/${seriesId}/${token}`;

    try {
      const html = await sourceHttpClient.fetchText(url, {
        sourceId: this.metadata.id,
        referer: `${this.baseUrl}/`,
        headers: this.getRequestHeaders(),
      });

      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
      if (!nextDataMatch) return [];

      const json = JSON.parse(nextDataMatch[1]);
      const chapterData = json.props?.pageProps?.chapter;
      const images: any[] = chapterData?.images || [];

      return images.map((imgName: string, index: number) => ({
        index,
        url: `${this.cdnBase}/uploads/images/series/${seriesId}/${token}/${imgName}`,
        headers: {
          Referer: `${this.baseUrl}/`,
          'User-Agent': DEFAULT_USER_AGENT,
        },
      }));
    } catch (err) {
      console.error(`[FlameComicsParser] getPages failed for ${chapter.id}:`, err);
      return [];
    }
  }
}
