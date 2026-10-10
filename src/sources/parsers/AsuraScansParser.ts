/**
 * AsuraScans parser.
 *
 * Asura uses an Astro-rendered site. Series/chapter links are available in
 * the HTML, while reader images are commonly serialized in Astro island
 * props as `{ order, url }` objects.
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
import { DEFAULT_USER_AGENT, sourceHttpClient } from '../network/httpClient';

type LooseRecord = Record<string, any>;

export class AsuraScansParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'asurascans',
      name: 'AsuraScans',
      domain: 'asuracomic.net',
      baseUrl: 'https://asurascans.com',
      locale: 'en',
      isNsfw: false,
      version: '1.2.0',
      icon: 'https://www.google.com/s2/favicons?domain=asuracomic.net&sz=64',
      description: 'English manga, manhwa, and manhua from AsuraScans.',
      availableSortOrders: ['popular', 'latest', 'newest', 'alphabetical'],
      enabled: true,
      ...metadata,
    };
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Update' },
      { id: 'newest', label: 'Newest Series' },
      { id: 'alphabetical', label: 'A-Z' },
    ];
  }

  private cachedTags: SourceTag[] | null = null;

  public override async getAvailableTags(): Promise<SourceTag[]> {
    if (this.cachedTags && this.cachedTags.length > 0) return this.cachedTags;

    try {
      const json = await sourceHttpClient.fetchJson<any>('https://api.asurascans.com/api/genres', {
        sourceId: this.metadata.name,
        referer: 'https://asurascans.com/',
      });
      if (Array.isArray(json?.data) && json.data.length > 0) {
        this.cachedTags = json.data.map((g: any) => ({
          id: g.slug || g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          label: g.name,
          group: 'Genre',
        }));
        return this.cachedTags;
      }
    } catch {
      // Fallback
    }

    this.cachedTags = [
      { id: 'action', label: 'Action', group: 'Genre' },
      { id: 'adventure', label: 'Adventure', group: 'Genre' },
      { id: 'comedy', label: 'Comedy', group: 'Genre' },
      { id: 'crazy-mc', label: 'Crazy MC', group: 'Genre' },
      { id: 'dark-fantasy', label: 'Dark Fantasy', group: 'Genre' },
      { id: 'demon', label: 'Demon', group: 'Genre' },
      { id: 'drama', label: 'Drama', group: 'Genre' },
      { id: 'dungeons', label: 'Dungeons', group: 'Genre' },
      { id: 'fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'game', label: 'Game', group: 'Genre' },
      { id: 'genius-mc', label: 'Genius MC', group: 'Genre' },
      { id: 'isekai', label: 'Isekai', group: 'Genre' },
      { id: 'magic', label: 'Magic', group: 'Genre' },
      { id: 'martial-arts', label: 'Martial Arts', group: 'Genre' },
      { id: 'murim', label: 'Murim', group: 'Genre' },
      { id: 'mystery', label: 'Mystery', group: 'Genre' },
      { id: 'necromancer', label: 'Necromancer', group: 'Genre' },
      { id: 'overpowered', label: 'Overpowered', group: 'Genre' },
      { id: 'psychological', label: 'Psychological', group: 'Genre' },
      { id: 'regression', label: 'Regression', group: 'Genre' },
      { id: 'reincarnation', label: 'Reincarnation', group: 'Genre' },
      { id: 'revenge', label: 'Revenge', group: 'Genre' },
      { id: 'romance', label: 'Romance', group: 'Genre' },
      { id: 'school-life', label: 'School Life', group: 'Genre' },
      { id: 'sci-fi', label: 'Sci-fi', group: 'Genre' },
      { id: 'shoujo', label: 'Shoujo', group: 'Genre' },
      { id: 'shounen', label: 'Shounen', group: 'Genre' },
      { id: 'supernatural', label: 'Supernatural', group: 'Genre' },
      { id: 'system', label: 'System', group: 'Genre' },
      { id: 'tower', label: 'Tower', group: 'Genre' },
      { id: 'tragedy', label: 'Tragedy', group: 'Genre' },
      { id: 'transmigration', label: 'Transmigration', group: 'Genre' },
      { id: 'villain', label: 'Villain', group: 'Genre' },
      { id: 'violence', label: 'Violence', group: 'Genre' },
    ];
    return this.cachedTags;
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    let genreSlug = '';
    if (filter.tags && filter.tags.length > 0 && filter.tags[0]) {
      genreSlug = filter.tags[0].toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    const genreParam = genreSlug ? `&genres=${encodeURIComponent(genreSlug)}` : '';

    // 1. If search query is provided, use Asura's official search API
    if (filter.query?.trim()) {
      const q = filter.query.trim();
      try {
        const url = `https://api.asurascans.com/api/search?q=${encodeURIComponent(q)}${genreParam}&offset=${offset}&limit=${pageSize}`;
        const json = await sourceHttpClient.fetchJson<any>(url, {
          sourceId: this.metadata.name,
          referer: 'https://asurascans.com/',
          headers: {
            Accept: 'application/json, text/plain, */*',
            'User-Agent': DEFAULT_USER_AGENT,
          },
        });

        const items = Array.isArray(json?.data) ? json.data : [];
        if (items.length > 0) {
          return items.map((item: any) => {
            const rawSlug =
              (item.public_url ? item.public_url.replace(/^\/(?:comics|series)\//, '') : '') ||
              item.slug ||
              '';
            const slug = rawSlug.replace(/^\/+/, '');
            const publicUrl = item.public_url
              ? `https://asurascans.com${item.public_url}`
              : `https://asurascans.com/comics/${slug}`;
            const url = item.public_url || `/comics/${slug}`;

            return {
              id: `${this.metadata.id}:${slug}`,
              sourceId: this.metadata.id,
              url,
              publicUrl,
              title: item.title || this.titleFromSlug(slug),
              coverUrl: item.cover || null,
              description: item.description ? item.description.replace(/<[^>]*>/g, '').trim() : undefined,
              rating: item.rating ? Number(item.rating.toFixed(1)) : undefined,
              authors: item.author ? [item.author] : undefined,
              artists: item.artist ? [item.artist] : undefined,
              tags: Array.isArray(item.genres)
                ? item.genres.map((g: any) => g.name || g.slug).filter(Boolean)
                : undefined,
              state: item.status === 'ongoing' ? 'ongoing' : item.status === 'completed' ? 'completed' : undefined,
              chaptersCount: item.chapter_count || undefined,
            };
          });
        }
        return [];
      } catch (err) {
        console.warn('Asura search API error, falling back to HTML catalog:', err);
      }
    }

    // 2. Paginated catalog using official API
    try {
      const seriesUrl = `https://api.asurascans.com/api/series?offset=${offset}&limit=${pageSize}${genreParam}`;
      const json = await sourceHttpClient.fetchJson<any>(seriesUrl, {
        sourceId: this.metadata.name,
        referer: 'https://asurascans.com/',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': DEFAULT_USER_AGENT,
        },
      });

      const items = Array.isArray(json?.data) ? json.data : [];
      if (items.length > 0) {
        return items.map((item: any) => {
          const rawSlug =
            (item.public_url ? item.public_url.replace(/^\/(?:comics|series)\//, '') : '') ||
            item.slug ||
            '';
          const slug = rawSlug.replace(/^\/+/, '');
          const publicUrl = item.public_url
            ? `https://asurascans.com${item.public_url}`
            : `https://asurascans.com/comics/${slug}`;
          const url = item.public_url || `/comics/${slug}`;

          return {
            id: `${this.metadata.id}:${slug}`,
            sourceId: this.metadata.id,
            url,
            publicUrl,
            title: item.title || this.titleFromSlug(slug),
            coverUrl: item.cover || null,
            description: item.description ? item.description.replace(/<[^>]*>/g, '').trim() : undefined,
            rating: item.rating ? Number(item.rating.toFixed(1)) : undefined,
            authors: item.author ? [item.author] : undefined,
            artists: item.artist ? [item.artist] : undefined,
            tags: Array.isArray(item.genres)
              ? item.genres.map((g: any) => g.name || g.slug).filter(Boolean)
              : undefined,
            state: item.status === 'ongoing' ? 'ongoing' : item.status === 'completed' ? 'completed' : undefined,
            chaptersCount: item.chapter_count || undefined,
          };
        });
      }
    } catch {
      // Fallback to HTML scraping
    }

    // 3. Fallback: HTML scraping
    const params = new URLSearchParams({ page: String(page) });
    if (filter.query?.trim()) params.set('name', filter.query.trim());
    if (filter.order === 'alphabetical') params.set('order', 'title');
    else if (filter.order === 'newest') params.set('order', 'latest');
    else if (filter.order === 'latest') params.set('order', 'update');

    const $ = await this.fetchWithRetry(`${this.metadata.baseUrl}/comics?${params.toString()}`);
    let results = this.parseCatalog($.root.innerHTML || '');
    if (filter.query?.trim()) {
      const q = filter.query.trim().toLowerCase();
      results = results.filter(
        (m) => m.title.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
      );
    }
    return results;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const url = this.toSeriesUrl(manga.url);
    const $ = await this.fetchHtml(url);
    const html = $.root.innerHTML || '';
    const slug = this.extractSlug(url);
    const candidateTitle = this.firstText($, ['h1', '.text-xl.font-bold']);
    const title = candidateTitle && !/read free manga|asura scans/i.test(candidateTitle)
      ? candidateTitle
      : this.titleFromSlug(slug) || manga.title;
    const cover = this.firstImage($, html);

    // 1. Author and Artist extraction
    const authors: string[] = [];
    const artists: string[] = [];

    // Check JSON in Astro island or script tags
    const authorJsonMatch = html.match(/"author"\s*:\s*"([^"]+)"/i);
    if (authorJsonMatch && authorJsonMatch[1]) {
      const a = this.cleanText(authorJsonMatch[1]);
      if (a && !/^(n\/a|tba|-|updating|unknown)$/i.test(a)) authors.push(a);
    }
    const artistJsonMatch = html.match(/"artist"\s*:\s*"([^"]+)"/i);
    if (artistJsonMatch && artistJsonMatch[1]) {
      const a = this.cleanText(artistJsonMatch[1]);
      if (a && !/^(n\/a|tba|-|updating|unknown)$/i.test(a)) artists.push(a);
    }

    // Inspect metadata rows in HTML
    $('h3, span, div, b, strong, p').each((_, el) => {
      const txt = this.cleanText(el.text());
      if (/^author/i.test(txt)) {
        const val = txt.replace(/^author[s]?\s*[:\-]?\s*/i, '').trim();
        if (val && !/^(n\/a|tba|-|updating|unknown)$/i.test(val) && !authors.length) {
          authors.push(val);
        }
      }
      if (/^artist/i.test(txt)) {
        const val = txt.replace(/^artist[s]?\s*[:\-]?\s*/i, '').trim();
        if (val && !/^(n\/a|tba|-|updating|unknown)$/i.test(val) && !artists.length) {
          artists.push(val);
        }
      }
    });

    if (!authors.length) {
      const m = html.match(/(?:Author|Author\(s\)|Penulis)[\s:]*<\/?[^>]*>[\s:]*([A-Za-z0-9\s._-]+?)(?:\s*<|\n|$)/i);
      if (m && m[1]) {
        const val = this.cleanText(m[1]);
        if (val && !/^(n\/a|tba|-|updating|unknown)$/i.test(val)) authors.push(val);
      }
    }

    if (!artists.length) {
      const m = html.match(/(?:Artist|Artis)[\s:]*<\/?[^>]*>[\s:]*([A-Za-z0-9\s._-]+?)(?:\s*<|\n|$)/i);
      if (m && m[1]) {
        const val = this.cleanText(m[1]);
        if (val && !/^(n\/a|tba|-|updating|unknown)$/i.test(val)) artists.push(val);
      }
    }

    // 2. Description extraction
    let description = '';
    const descJsonMatch = html.match(/"(?:description|synopsis)"\s*:\s*"([^"]+)"/i);
    if (descJsonMatch && descJsonMatch[1]) {
      try {
        description = this.stripHtml(JSON.parse(`"${descJsonMatch[1]}"`));
      } catch {
        description = this.stripHtml(descJsonMatch[1]);
      }
    }

    if (!description || description.toLowerCase().includes('discord')) {
      const metaDesc = $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') || '';
      if (metaDesc && !/read free manga|asura scans|all chapters/i.test(metaDesc)) {
        description = this.cleanText(metaDesc);
      }
    }

    if (!description || description.toLowerCase().includes('discord')) {
      description = this.firstText($, [
        'span.font-medium.text-sm',
        'span.font-normal.text-sm',
        '[class*="synopsis"]',
        '[class*="description"]',
        'div.text-sm.text-[#A2A2A2]',
        'p.text-sm',
      ]);
    }

    if (description && (description.toLowerCase() === 'discord' || /join our discord/i.test(description))) {
      description = manga.description || '';
    }

    const chapters = this.parseChapterLinks(html, manga.id, slug, url);

    return {
      ...manga,
      title,
      url: manga.url,
      publicUrl: url,
      coverUrl: cover || manga.coverUrl,
      description: description || manga.description,
      authors: authors.length ? authors : manga.authors,
      artists: artists.length ? artists : manga.artists,
      chaptersCount: chapters.length || manga.chaptersCount,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const url = this.toSeriesUrl(manga.url);
    const $ = await this.fetchHtml(url);
    return this.parseChapterLinks($.root.innerHTML || '', manga.id, this.extractSlug(url), url);
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const raw = chapter.url || chapter.id.replace(/^[^:]+:/, '');
    const url = this.toChapterUrl(raw);
    const $ = await this.fetchHtml(url);
    const html = $.root.innerHTML || '';
    const pages = this.extractPageObjects(html, $.root.querySelectorAll('astro-island'));

    if (!pages.length) {
      $('#readerarea img, #viewer-img img, .check-box img, .inner-content img').each((index, element) => {
        const src =
          element.attr('data-src') ||
          element.attr('data-lazy-src') ||
          element.attr('data-original') ||
          element.attr('data-image') ||
          element.attr('data-url') ||
          element.attr('src') ||
          '';
        if (src && !src.includes('data:image') && !/logo|cover|profile|chevron|loader/i.test(src)) {
          pages.push({ index, url: src });
        }
      });
    }

    return pages
      .sort((a, b) => a.index - b.index)
      .map((page, index) => ({
        index,
        url: this.absolute(page.url, url),
        headers: this.getRequestHeaders(),
      }));
  }

  public resolveUrl(url: string): { type: 'manga' | 'chapter'; id: string } | null {
    if (
      !url.includes(this.metadata.domain) &&
      !url.includes('asuracomic.net') &&
      !url.includes('asurascans.com')
    ) {
      return null;
    }
    const chapter = url.match(/\/(?:series|comics)\/([^/]+)\/chapter\/([^/?#]+)/i);
    if (chapter) return { type: 'chapter', id: url };
    const manga = url.match(/\/(?:series|comics)\/([^/?#]+)/i);
    return manga ? { type: 'manga', id: url } : null;
  }

  private parseCatalog(html: string): SourceManga[] {
    const $ = this.load(html);
    const seen = new Set<string>();
    const results: SourceManga[] = [];

    $('a[href*="/series/"], a[href*="/comics/"]').each((_, element) => {
      const href = element.attr('href') || '';
      if (!href || href.includes('/chapter/')) return;
      const url = this.absolute(href);
      const slug = this.extractSlug(url);
      if (!slug || seen.has(slug)) return;
      const spanTexts = element.find('span').map((_, span) => this.cleanText(span.text()));
      const title = this.cleanText(
        spanTexts.find((value: string) => value && !/^\d+(?:\.\d+)?$/.test(value) && !/^(chapter|ongoing|completed|new)$/i.test(value)) ||
        element.attr('title') ||
        element.find('h2, h3, h4').first().text() ||
        element.find('img').first().attr('alt') ||
        ''
      );
      if (!title || /chapter/i.test(title)) return;
      seen.add(slug);
      results.push({
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        url,
        publicUrl: url,
        title,
        coverUrl: this.imageFromElement(element),
      });
    });
    return results;
  }

  private async fetchWithRetry(url: string): Promise<any> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.fetchHtml(url);
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    }
    throw lastError;
  }

  private parseChapterLinks(html: string, mangaId: string, mangaSlug: string, baseUrl: string): SourceChapter[] {
    const $ = this.load(html);
    const chapters: SourceChapter[] = [];
    const seen = new Set<string>();

    $('a[href*="/chapter/"]').each((_, element) => {
      const href = element.attr('href') || '';
      const url = this.absolute(href, baseUrl);
      const chapterSlug = this.extractSlug(url);
      const parentSeries = url.match(/\/(?:series|comics)\/([^/]+)\/chapter\//i)?.[1];
      if (!url || !chapterSlug || (mangaSlug && parentSeries && parentSeries !== mangaSlug) || seen.has(url)) return;

      const number = this.chapterNumber(url);
      if (!number && !/chapter/i.test(element.text())) return;
      seen.add(url);
      const seriesSlug = parentSeries || mangaSlug;
      const chapterParam = url.match(/\/chapter\/([^/?#]+)/i)?.[1] || String(number);
      chapters.push({
        id: `${this.metadata.id}:${seriesSlug}:${chapterParam}`,
        sourceId: this.metadata.id,
        mangaId,
        url,
        name: this.chapterName(element.text(), number),
        number,
        dateUpload: this.parseDate(this.cleanText(element.parent().text())) || undefined,
      });
    });
    return chapters;
  }

  private extractPageObjects(html: string, islands: any[]): { index: number; url: string }[] {
    const sources = [html, ...islands.map((island) => island.getAttribute('props') || '')];
    const pages: { index: number; url: string }[] = [];
    const seen = new Set<string>();

    for (const source of sources) {
      // Astro may HTML-escape or JSON-escape the island props.
      const normalized = source
        .replace(/\\\\\//g, '/')
        .replace(/\\\\"/g, '"')
        .replace(/&quot;/g, '"');

      // 1. Asura chapter CDN image pattern (primary and fastest)
      const chapterImgRegex = /https?:\/\/cdn\.asurascans\.com\/asura-images\/chapters\/[^\s"'<>\\]+/gi;
      for (const match of normalized.matchAll(chapterImgRegex)) {
        this.addPage(pages, seen, pages.length, match[0]);
      }

      // 2. Legacy order + url pairs
      const pagePattern = /["']order["']\s*:\s*([\d]+)[\s\S]{0,500}?["']url["']\s*:\s*["']([^"']+)["']/gi;
      const reversePattern = /["']url["']\s*:\s*["']([^"']+)["'][\s\S]{0,500}?["']order["']\s*:\s*([\d]+)/gi;
      for (const match of normalized.matchAll(pagePattern)) this.addPage(pages, seen, Number(match[1]), match[2]);
      for (const match of normalized.matchAll(reversePattern)) this.addPage(pages, seen, Number(match[2]), match[1]);

      // 3. Last-resort fallback for other potential reader image URLs
      if (!pages.length) {
        let fallbackIndex = pages.length;
        for (const match of normalized.matchAll(/(?:https?:)?\/\/[^"'\\s]+?\.(?:jpe?g|png|webp)(?:\?[^"'\\s]*)?/gi)) {
          this.addPage(pages, seen, fallbackIndex++, match[0]);
        }
      }
    }
    return pages;
  }

  private addPage(pages: { index: number; url: string }[], seen: Set<string>, index: number, rawUrl: string) {
    const url = rawUrl.replace(/\\\//g, '/').replace(/&amp;/g, '&');
    if (!url || seen.has(url) || (!/^https?:\/\//i.test(url) && !url.startsWith('/'))) return;
    // Filter out common non-chapter assets
    if (/\/covers\/|\/banners\/|\/logo|favicon|avatar|icon/i.test(url)) return;
    seen.add(url);
    pages.push({ index, url });
  }

  private firstText($: any, selectors: string[]): string {
    for (const selector of selectors) {
      const value = this.cleanText($(selector).first().text());
      if (value) return value;
    }
    return '';
  }

  private firstImage($: any, html: string): string | null {
    const cover = $('img').map((_, element) => element.attr('src') || element.attr('data-src') || '').find((src: string) => /\/covers\//i.test(src));
    const ogImage = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1];
    return cover ? this.absolute(cover) : ogImage ? this.absolute(ogImage) : null;
  }

  private imageFromElement(element: any): string | null {
    const image = element.find('img').first();
    const src = image.attr('src') || image.attr('data-src') || '';
    return src ? this.absolute(src) : null;
  }

  private load(html: string): any {
    // Kept local to avoid exposing the HTML implementation through the parser API.
    const { loadHtml } = require('../network/htmlParser');
    return loadHtml(html);
  }

  private absolute(url: string, base = this.metadata.baseUrl): string {
    return this.toAbsoluteUrl(url, base);
  }

  private extractSlug(url: string): string {
    const match = url.match(/\/(?:series|comics)\/([^/]+)/i);
    return match?.[1] || '';
  }

  private chapterNumber(value: string): number {
    const fromUrl = value.match(/\/chapter\/([\d]+(?:\.\d+)?)/i);
    if (fromUrl) return Number(fromUrl[1]);
    return this.parseChapterNumber(value);
  }

  private chapterName(text: string, number: number): string {
    const clean = this.cleanText(text);
    const match = clean.match(/^(Chapter\s+\d+(?:\.\d+)?(?:\s*-\s*.*?))(?=\d+\s*(?:minute|hour|day|week|month)s?\s*ago|$)/i);
    return this.cleanText(match?.[1] || `Chapter ${number}`);
  }

  private titleFromSlug(slug: string): string {
    return slug.replace(/-[a-z\d]{6,}$/i, '').replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private toSeriesUrl(slugOrPath: string): string {
    if (/^https?:\/\//i.test(slugOrPath)) {
      return slugOrPath.replace(/asuracomic\.net/gi, 'asurascans.com');
    }
    const clean = slugOrPath.replace(/^\/+/, '');
    if (clean.startsWith('comics/') || clean.startsWith('series/')) {
      return `${this.metadata.baseUrl}/${clean}`;
    }
    return `${this.metadata.baseUrl}/comics/${clean}`;
  }

  private toChapterUrl(rawIdOrUrl: string): string {
    const httpIdx = rawIdOrUrl.search(/https?:\/\//i);
    if (httpIdx >= 0) {
      return rawIdOrUrl.substring(httpIdx).replace(/asuracomic\.net/gi, 'asurascans.com');
    }

    const parts = rawIdOrUrl.split(':');
    const chPart = parts[parts.length - 1];
    const seriesPart = parts.length >= 2 ? parts[parts.length - 2] : '';

    if (seriesPart && chPart && !seriesPart.startsWith('/')) {
      const chNum = chPart.replace(/^chapter-?/i, '');
      return `${this.metadata.baseUrl}/comics/${seriesPart}/chapter/${chNum}`;
    }

    const clean = rawIdOrUrl.replace(/^\/+/, '');
    if (clean.startsWith('comics/') || clean.startsWith('series/')) {
      return `${this.metadata.baseUrl}/${clean}`;
    }
    return `${this.metadata.baseUrl}/comics/${clean}`;
  }
}
