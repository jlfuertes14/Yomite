/**
* ReiManga Parser
*
* Implements scraping and API integration for https://reimanga.net:
* - Direct REST API for catalog, search, and details:
*    - /api/manga/latest-updates?limit=24
*    - /api/manga/trending?limit=24&full=1
*    - /api/manga/new?limit=24
*    - /api/manga/search/advanced?title={query}&limit=24
*    - /api/manga/{id}
* - Direct cover URL generation: https://reimanga.net/covers/{id}/thumbnail.webp
* - HTML fallbacks for browse and chapter reader pages.
*/
import { DEFAULT_USER_AGENT, sourceHttpClient } from '../network/httpClient';
import {
  MangaSourceMetadata,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
  SourceSortOption,
  SourceTag,
} from '../types';
import { BaseParser } from './BaseParser';

export class ReiMangaParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'reimanga',
      name: 'ReiManga',
      domain: 'reimanga.net',
      baseUrl: 'https://reimanga.net',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=reimanga.net&sz=64',
      description: 'Extensive library of manga, manhwa, and manhua with fast updates.',
      availableSortOrders: ['popular', 'latest', 'newest', 'rating', 'alphabetical'],
      enabled: true,
      ...metadata,
    };
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json, text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Trending' },
      { id: 'latest', label: 'Latest Updates' },
      { id: 'newest', label: 'New Manga' },
      { id: 'rating', label: 'Top Rated' },
    ];
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'Action', label: 'Action', group: 'Genre' },
      { id: 'Adventure', label: 'Adventure', group: 'Genre' },
      { id: 'Comedy', label: 'Comedy', group: 'Genre' },
      { id: 'Drama', label: 'Drama', group: 'Genre' },
      { id: 'Fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'Isekai', label: 'Isekai', group: 'Genre' },
      { id: 'Martial Arts', label: 'Martial Arts', group: 'Genre' },
      { id: 'Manhwa', label: 'Manhwa', group: 'Genre' },
      { id: 'Manhua', label: 'Manhua', group: 'Genre' },
      { id: 'Manga', label: 'Manga', group: 'Genre' },
      { id: 'Mystery', label: 'Mystery', group: 'Genre' },
      { id: 'Psychological', label: 'Psychological', group: 'Genre' },
      { id: 'Romance', label: 'Romance', group: 'Genre' },
      { id: 'School Life', label: 'School Life', group: 'Genre' },
      { id: 'Sci-Fi', label: 'Sci-Fi', group: 'Genre' },
      { id: 'Seinen', label: 'Seinen', group: 'Genre' },
      { id: 'Shounen', label: 'Shounen', group: 'Genre' },
      { id: 'Slice of Life', label: 'Slice of Life', group: 'Genre' },
      { id: 'Supernatural', label: 'Supernatural', group: 'Genre' },
      { id: 'Tragedy', label: 'Tragedy', group: 'Genre' },
      { id: 'Ecchi', label: 'Ecchi', group: 'Genre' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const genre = filter.tags && filter.tags.length > 0 ? filter.tags[0] : '';

    // 1. If searching with a text query or filtering by genre, use advanced search
    if (filter.query?.trim() || genre) {
      const q = encodeURIComponent(filter.query?.trim() || '');
      const genreParam = genre ? `&genre=${encodeURIComponent(genre)}` : '';
      try {
        const json = await sourceHttpClient.fetchJson<any>(
          `${this.metadata.baseUrl}/api/manga/search/advanced?title=${q}${genreParam}&limit=24`,
          { headers: this.getRequestHeaders() }
        );
        if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
          return json.data.map((item: any) => this.mapApiItemToManga(item));
        }
      } catch {
        // Fallback to HTML scraping below
      }

      return this.scrapeHtmlCatalog(`${this.metadata.baseUrl}/advanced-search?q=${q}${genreParam}&page=${page}`);
    }

    // 2. Filter / Sort Order API mappings
    let endpoint = `${this.metadata.baseUrl}/api/manga/trending?limit=24&full=1`;
    if (filter.order === 'latest') {
      endpoint = `${this.metadata.baseUrl}/api/manga/latest-updates?limit=24`;
    } else if (filter.order === 'newest') {
      endpoint = `${this.metadata.baseUrl}/api/manga/new?limit=24`;
    } else if (filter.order === 'rating' || filter.order === 'popular') {
      endpoint = `${this.metadata.baseUrl}/api/manga/trending?limit=24&full=1`;
    }

    try {
      const json = await sourceHttpClient.fetchJson<any>(endpoint, {
        headers: this.getRequestHeaders(),
      });
      const items = Array.isArray(json) ? json : json?.data;
      if (items && Array.isArray(items) && items.length > 0) {
        return items.map((item: any) => this.mapApiItemToManga(item));
      }
    } catch {
      // Fallback to HTML scraping
    }

    const htmlPath = filter.order === 'latest' ? '/latest-update' : '/advanced-search';
    return this.scrapeHtmlCatalog(`${this.metadata.baseUrl}${htmlPath}?page=${page}`);
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const numericId = this.extractNumericId(manga.url || manga.id);

    if (numericId) {
      try {
        const json = await sourceHttpClient.fetchJson<any>(
          `${this.metadata.baseUrl}/api/manga/${numericId}`,
          { headers: this.getRequestHeaders() }
        );

        if (json?.manga) {
          const m = json.manga;
          const genres = Array.isArray(m.genres) ? m.genres.map((g: any) => g.name).filter(Boolean) : [];
          const authors = Array.isArray(m.authors) ? m.authors.map((a: any) => a.name).filter(Boolean) : [];

          return {
            ...manga,
            title: m.title || manga.title,
            altTitles: m.alt_title ? [m.alt_title] : manga.altTitles,
            description: this.cleanText(m.description || m.ai_description || manga.description),
            rating: m.rating ? parseFloat(m.rating) : manga.rating,
            tags: genres.length > 0 ? genres : manga.tags,
            authors: authors.length > 0 ? authors : manga.authors,
            state: m.status === 1 ? 'completed' : 'ongoing',
            coverUrl: `https://reimanga.net/covers/${numericId}/thumbnail.webp`,
          };
        }
      } catch {
        // Fallback to HTML details
      }
    }

    // HTML fallback
    try {
      const seriesUrl = this.toSeriesUrl(manga.url || manga.id);
      const $ = await this.fetchHtml(seriesUrl);
      const title = this.cleanText($('h1').first().text() || manga.title);

      // 1. Try __NEXT_DATA__ Next.js hydration payload
      const nextDataText = $('#__NEXT_DATA__').text();
      if (nextDataText) {
        try {
          const parsed = JSON.parse(nextDataText);
          const m = parsed?.props?.pageProps?.manga || parsed?.props?.pageProps?.series;
          if (m) {
            const genres = Array.isArray(m.genres) ? m.genres.map((g: any) => g.name || g).filter(Boolean) : [];
            const authors = Array.isArray(m.authors) ? m.authors.map((a: any) => a.name || a).filter(Boolean) : [];
            const desc = this.stripHtml(m.description || m.ai_description || m.summary);
            const cover = m.cover_image || m.thumbnail || (m.id ? `https://reimanga.net/covers/${m.id}/thumbnail.webp` : null);

            return {
              ...manga,
              title: m.title || title,
              altTitles: m.alt_title ? [m.alt_title] : manga.altTitles,
              description: desc || manga.description,
              rating: m.rating ? parseFloat(m.rating) : manga.rating,
              tags: genres.length > 0 ? genres : manga.tags,
              authors: authors.length > 0 ? authors : manga.authors,
              state: m.status === 1 ? 'completed' : 'ongoing',
              coverUrl: cover ? this.toAbsoluteUrl(cover) : manga.coverUrl,
            };
          }
        } catch {}
      }

      // 2. Extract authors from HTML anchors or labels
      const authors: string[] = [];
      $('a[href*="/author/"], a[href*="/artist/"]').each((_, a) => {
        const name = this.cleanText(a.text());
        if (name && !authors.includes(name)) authors.push(name);
      });

      if (!authors.length) {
        $('h3, span, div, b, strong, p').each((_, el) => {
          const txt = this.cleanText(el.text());
          if (/^author/i.test(txt) && !authors.length) {
            const val = txt.replace(/^author[s]?\s*[:\-]?\s*/i, '').trim();
            if (val && !/^(n\/a|tba|-|updating|unknown)$/i.test(val)) authors.push(val);
          }
        });
      }

      // 3. Extract description
      const metaDesc = $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') || '';
      const bodyDesc = this.stripHtml(
        $('[class*="description"], [class*="synopsis"], .description, .synopsis, p.text-gray-300, p.text-sm').first().text()
      );
      const desc = (!metaDesc || /read free|reimanga/i.test(metaDesc)) ? bodyDesc : this.cleanText(metaDesc);
      const cover = $('img[src*="/covers/"]').first().attr('src') || manga.coverUrl;

      return {
        ...manga,
        title,
        description: desc || manga.description,
        authors: authors.length ? authors : manga.authors,
        coverUrl: cover ? this.toAbsoluteUrl(cover) : manga.coverUrl,
      };
    } catch {
      return manga;
    }
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const numericId = this.extractNumericId(manga.url || manga.id);
    const slug = this.extractSlug(manga.url || manga.id);
    let chapterCount = 0;

    // 1. Try to get chapters from JSON API
    if (numericId) {
      try {
        const json = await sourceHttpClient.fetchJson<any>(
          `${this.metadata.baseUrl}/api/manga/${numericId}`,
          { headers: this.getRequestHeaders() }
        );
        if (json?.manga?.chapter_count) {
          chapterCount = parseInt(json.manga.chapter_count, 10) || 0;
        }

        const apiChapters = Array.isArray(json?.chapters)
          ? json.chapters
          : Array.isArray(json?.manga?.chapters)
          ? json.manga.chapters
          : [];

        if (apiChapters.length > 0) {
          return apiChapters.map((ch: any, idx: number) => {
            const chNum = typeof ch.number === 'number' ? ch.number : parseFloat(ch.chapter || ch.name || `${idx + 1}`) || idx + 1;
            const chSlug = ch.slug || ch.id || String(chNum);
            return {
              id: `${this.metadata.id}:${slug}:${chSlug}`,
              sourceId: this.metadata.id,
              mangaId: manga.id,
              url: `${this.metadata.baseUrl}/manga/${slug}/${chSlug}`,
              name: ch.title || ch.name || `Chapter ${chNum}`,
              number: chNum,
              dateUpload: ch.created_at ? Date.parse(ch.created_at) : undefined,
            };
          });
        }
      } catch {
        // Ignore and continue
      }
    }

    // 2. Try scraping series HTML for chapters list
    try {
      const seriesUrl = this.toSeriesUrl(manga.url || manga.id);
      const $ = await this.fetchHtml(seriesUrl);

      // Check __NEXT_DATA__
      const nextDataText = $('#__NEXT_DATA__').text();
      if (nextDataText) {
        try {
          const parsed = JSON.parse(nextDataText);
          const chList = parsed?.props?.pageProps?.chapters || parsed?.props?.pageProps?.manga?.chapters;
          if (Array.isArray(chList) && chList.length > 0) {
            return chList.map((ch: any, idx: number) => {
              const chNum = typeof ch.number === 'number' ? ch.number : parseFloat(ch.chapter || ch.name || `${idx + 1}`) || idx + 1;
              const chSlug = ch.slug || ch.id || String(chNum);
              return {
                id: `${this.metadata.id}:${slug}:${chSlug}`,
                sourceId: this.metadata.id,
                mangaId: manga.id,
                url: `${this.metadata.baseUrl}/manga/${slug}/${chSlug}`,
                name: ch.title || ch.name || `Chapter ${chNum}`,
                number: chNum,
                dateUpload: ch.created_at ? Date.parse(ch.created_at) : undefined,
              };
            });
          }
        } catch {}
      }

      const chapters: SourceChapter[] = [];
      const seen = new Set<string>();

      $('a[href*="/manga/"]').each((_, el) => {
        const href = el.attr('href') || '';
        // Look for chapter link e.g. /manga/{slug}-{id}/{chapterNum}
        const m = href.match(/\/manga\/[^/]+\/([0-9.]+)/i);
        if (!m) return;
        const chNumStr = m[1];
        if (seen.has(chNumStr)) return;
        seen.add(chNumStr);

        const chNum = parseFloat(chNumStr) || 0;
        const titleText = this.cleanText(el.text()) || `Chapter ${chNumStr}`;

        chapters.push({
          id: `${this.metadata.id}:${slug}:${chNumStr}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          url: this.toAbsoluteUrl(href),
          name: titleText,
          number: chNum,
        });
      });

      if (chapters.length > 0) {
        chapters.sort((a, b) => (b.number || 0) - (a.number || 0));
        return chapters;
      }
    } catch {
      // HTML scraping failed
    }

    // 3. If HTML was blocked but we know chapterCount from API, generate chapter stubs
    if (chapterCount > 0 && slug) {
      const generatedChapters: SourceChapter[] = [];
      for (let i = chapterCount; i >= 1; i--) {
        generatedChapters.push({
          id: `${this.metadata.id}:${slug}:${i}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          url: `${this.metadata.baseUrl}/manga/${slug}/${i}`,
          name: `Chapter ${i}`,
          number: i,
        });
      }
      return generatedChapters;
    }

    return [];
  }

  private toSeriesUrl(input: string): string {
    if (!input) return `${this.metadata.baseUrl}/latest-update`;
    if (input.startsWith('http://') || input.startsWith('https://')) return input;
    const clean = input.replace(/^(?:reimanga:)?(?:\/manga\/)?/, '').replace(/^\/+/, '');
    return `${this.metadata.baseUrl}/manga/${clean}`;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const $ = await this.fetchHtml(chapter.url);
    const pages: SourcePage[] = [];
    const seen = new Set<string>();

    $('img[src*="covers/"], img[src*="reimanga.net"], img[src*="cdn"]').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (!src || src.includes('logo') || src.includes('icon') || src.includes('avatar')) return;
      const absUrl = this.toAbsoluteUrl(src);
      if (seen.has(absUrl)) return;
      seen.add(absUrl);

      pages.push({
        index: pages.length,
        url: absUrl,
        headers: this.getRequestHeaders(),
      });
    });

    return pages;
  }

  /**
   * Helper to map JSON item from /api/manga/* to SourceManga
   */
  private mapApiItemToManga(item: any): SourceManga {
    const id = item.id;
    const nameUrl = item.name_url || this.slugify(item.title || '');
    const slug = `${nameUrl}-${id}`;
    const coverUrl = `https://reimanga.net/covers/${id}/thumbnail.webp`;
    const rating = item.rating ? parseFloat(item.rating) : undefined;

    return {
      id: `${this.metadata.id}:${slug}`,
      sourceId: this.metadata.id,
      url: `${this.metadata.baseUrl}/manga/${slug}`,
      publicUrl: `${this.metadata.baseUrl}/manga/${slug}`,
      title: item.title || nameUrl,
      coverUrl,
      rating: !isNaN(rating as number) ? rating : undefined,
    };
  }

  /**
   * Scrapes manga cards from HTML page
   */
  private async scrapeHtmlCatalog(url: string): Promise<SourceManga[]> {
    const $ = await this.fetchHtml(url);
    const results: SourceManga[] = [];
    const seen = new Set<string>();

    $('a[href*="/manga/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      // Only match manga detail links: /manga/{name}-{id} (exclude chapter links with /manga/{name}-{id}/{ch})
      const m = href.match(/\/manga\/([^/?#]+)$/i);
      if (!m) return;
      const slug = m[1];
      if (seen.has(slug)) return;
      seen.add(slug);

      const title = this.cleanText(
        $(el).find('h3, .title, span').first().text() ||
        $(el).attr('title') ||
        $(el).find('img').first().attr('alt') ||
        slug
      );
      if (!title || /chapter/i.test(title)) return;

      const img = $(el).find('img').first();
      let cover = img.attr('src') || img.attr('data-src') || null;
      if (!cover) {
        const numId = this.extractNumericId(slug);
        if (numId) cover = `https://reimanga.net/covers/${numId}/thumbnail.webp`;
      }

      results.push({
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        url: `${this.metadata.baseUrl}/manga/${slug}`,
        publicUrl: `${this.metadata.baseUrl}/manga/${slug}`,
        title,
        coverUrl: cover ? this.toAbsoluteUrl(cover) : null,
      });
    });

    return results;
  }

  private extractNumericId(input: string): string | null {
    const m = input.match(/-([0-9]{3,10})(?:$|\/|:)/) || input.match(/([0-9]{3,10})/);
    return m ? m[1] : null;
  }

  private extractSlug(input: string): string {
    const clean = input.replace(/^(?:reimanga:)?(?:https?:\/\/[^/]+)?(?:\/manga\/)?/, '');
    const m = clean.match(/^([^/?#:]+)/);
    return m ? m[1] : clean;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
