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

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;

    // 1. If searching with a text query, use the advanced search API
    if (filter.query?.trim()) {
      const q = encodeURIComponent(filter.query.trim());
      try {
        const json = await sourceHttpClient.fetchJson<any>(
          `${this.metadata.baseUrl}/api/manga/search/advanced?title=${q}&limit=24`,
          { headers: this.getRequestHeaders() }
        );
        if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
          return json.data.map((item: any) => this.mapApiItemToManga(item));
        }
      } catch {
        // Fallback to HTML scraping below
      }

      return this.scrapeHtmlCatalog(`${this.metadata.baseUrl}/advanced-search?q=${q}&page=${page}`);
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
      const $ = await this.fetchHtml(manga.url);
      const title = this.cleanText($('h1').first().text() || manga.title);
      const desc = this.cleanText($('p.text-gray-300, .description, p').first().text() || manga.description);
      const cover = $('img[src*="/covers/"]').first().attr('src') || manga.coverUrl;

      return {
        ...manga,
        title,
        description: desc,
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

    // 1. Try to get chapter count from API
    if (numericId) {
      try {
        const json = await sourceHttpClient.fetchJson<any>(
          `${this.metadata.baseUrl}/api/manga/${numericId}`,
          { headers: this.getRequestHeaders() }
        );
        if (json?.manga?.chapter_count) {
          chapterCount = parseInt(json.manga.chapter_count, 10) || 0;
        }
      } catch {
        // Ignore and continue
      }
    }

    // 2. Try scraping HTML for chapters list
    try {
      const $ = await this.fetchHtml(manga.url);
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
      // HTML scraping failed (e.g. Cloudflare)
    }

    // 3. If HTML was blocked by Cloudflare but we know chapterCount from API, generate chapter stubs
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

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const $ = await this.fetchHtml(chapter.url);
    const pages: SourcePage[] = [];
    const seen = new Set<string>();

    $('img[src*="covers/"], img[src*="reimanga.net"], img[src*="cdn"]').each((i, el) => {
      const src = el.attr('src') || el.attr('data-src');
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
      const href = el.attr('href') || '';
      // Only match manga detail links: /manga/{name}-{id} (exclude chapter links with /manga/{name}-{id}/{ch})
      const m = href.match(/\/manga\/([^/?#]+)$/i);
      if (!m) return;
      const slug = m[1];
      if (seen.has(slug)) return;
      seen.add(slug);

      const title = this.cleanText(
        el.find('h3, .title, span').first().text() ||
        el.attr('title') ||
        el.find('img').first().attr('alt') ||
        slug
      );
      if (!title || /chapter/i.test(title)) return;

      const img = el.find('img').first();
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
