/**
 * MangaK Parser
 * Fast Next.js manga site with high-definition manhwa and comics
 * Real Domain: https://mangak.io
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
import fallbackCatalog from '../catalog/mangaKFallback.json';

export class MangaKParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: MangaSourceMetadata) {
    super();
    this.metadata = metadata || {
      id: 'mangak',
      name: 'MangaK',
      domain: 'mangak.io',
      baseUrl: 'https://mangak.io',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      description: 'MangaK - Read manga, manhwa, and comics online in high definition.',
      enabled: true,
      icon: 'https://www.google.com/s2/favicons?domain=mangak.io&sz=64',
      availableSortOrders: ['popular', 'latest', 'newest'],
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Updates' },
      { id: 'newest', label: 'Newest' },
    ];
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'action', label: 'Action', group: 'Genre' },
      { id: 'adventure', label: 'Adventure', group: 'Genre' },
      { id: 'comedy', label: 'Comedy', group: 'Genre' },
      { id: 'drama', label: 'Drama', group: 'Genre' },
      { id: 'fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'horror', label: 'Horror', group: 'Genre' },
      { id: 'manhwa', label: 'Manhwa', group: 'Genre' },
      { id: 'mystery', label: 'Mystery', group: 'Genre' },
      { id: 'psychological', label: 'Psychological', group: 'Genre' },
      { id: 'romance', label: 'Romance', group: 'Genre' },
      { id: 'sci-fi', label: 'Sci-Fi', group: 'Genre' },
      { id: 'shounen', label: 'Shounen', group: 'Genre' },
      { id: 'supernatural', label: 'Supernatural', group: 'Genre' },
      { id: 'webtoons', label: 'Webtoons', group: 'Genre' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    if (filter.query && filter.query.trim()) {
      return this.search(filter.query.trim(), page, filter);
    }
    if (filter.order === 'latest' || filter.order === 'newest') {
      return this.getLatest(page, filter);
    }
    return this.getPopular(page, filter);
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      Referer: 'https://mangak.io/',
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    };
  }

  private async fetchRawHtml(url: string): Promise<string> {
    try {
      return await sourceHttpClient.fetchText(this.toAbsoluteUrl(url), {
        referer: this.metadata.baseUrl,
        sourceId: this.metadata.name,
      });
    } catch (err: any) {
      if (err?.isCloudFlare || err?.name === 'CloudFlareError' || err?.status === 403) {
        throw err;
      }
      return '';
    }
  }

  private extractNextData(html: string): any {
    try {
      const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
      if (!match) return null;
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }

  private mapRawManga(raw: any): SourceManga | null {
    if (!raw) return null;
    const slug = raw.slug || (raw.url ? raw.url.replace(/^\//, '') : '');
    const title = raw.name || raw.title || raw.altName;
    if (!slug || !title) return null;

    const cover = raw.cover || (raw.id ? `https://rx.resmk.org/covers/${raw.id}.webp` : '');
    return {
      id: `mangak:${slug}`,
      sourceId: this.metadata.id,
      title: String(title).trim(),
      url: raw.url?.startsWith('/') ? raw.url : `/${slug}`,
      publicUrl: `https://mangak.io/${slug}`,
      coverUrl: cover,
      coverHeaders: this.getRequestHeaders(),
      description: raw.summary || raw.description || '',
      tags: Array.isArray(raw.genres) ? raw.genres.map((g: any) => g.name || g).filter(Boolean) : [],
      state: raw.status?.toLowerCase().includes('complete') ? 'completed' : 'ongoing',
    };
  }

  private getFallbackMatches(query?: string): SourceManga[] {
    const all = (fallbackCatalog as unknown as SourceManga[]) || [];
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q))
    );
  }

  public async getPopular(page = 1, _filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const html = await this.fetchRawHtml('https://mangak.io/home');
      const nextData = this.extractNextData(html);
      const items: any[] = [];

      if (nextData?.props?.pageProps) {
        const pp = nextData.props.pageProps;
        if (Array.isArray(pp.popularItems)) items.push(...pp.popularItems);
        if (Array.isArray(pp.trendingItems)) items.push(...pp.trendingItems);
        if (Array.isArray(pp.heroItems)) items.push(...pp.heroItems);
      }

      const mangas: SourceManga[] = [];
      const seen = new Set<string>();
      for (const item of items) {
        const m = this.mapRawManga(item);
        if (m && !seen.has(m.id)) {
          seen.add(m.id);
          mangas.push(m);
        }
      }

      if (mangas.length > 0) return mangas;
    } catch {
      // Fallback
    }

    return this.getFallbackMatches();
  }

  public async getLatest(page = 1, _filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const html = await this.fetchRawHtml('https://mangak.io/home');
      const nextData = this.extractNextData(html);
      const items: any[] = [];

      if (nextData?.props?.pageProps) {
        const pp = nextData.props.pageProps;
        if (pp.latest?.items && Array.isArray(pp.latest.items)) {
          items.push(...pp.latest.items);
        } else if (Array.isArray(pp.topUpdateItems)) {
          items.push(...pp.topUpdateItems);
        }
      }

      const mangas: SourceManga[] = [];
      const seen = new Set<string>();
      for (const item of items) {
        const m = this.mapRawManga(item);
        if (m && !seen.has(m.id)) {
          seen.add(m.id);
          mangas.push(m);
        }
      }

      if (mangas.length > 0) return mangas;
    } catch {
      // Fallback
    }

    return this.getFallbackMatches();
  }

  public async search(query: string, page = 1, _filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const searchUrl = `https://mangak.io/search?q=${encodeURIComponent(query)}&page=${page}`;
      const html = await this.fetchRawHtml(searchUrl);
      const nextData = this.extractNextData(html);
      const items = nextData?.props?.pageProps?.ssrItems || [];

      const mangas: SourceManga[] = [];
      const seen = new Set<string>();
      for (const item of items) {
        const m = this.mapRawManga(item);
        if (m && !seen.has(m.id)) {
          seen.add(m.id);
          mangas.push(m);
        }
      }

      if (mangas.length > 0) return mangas;
    } catch {
      // Fallback
    }

    return this.getFallbackMatches(query);
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const rawId = manga.url || manga.id;
    const slug = rawId.replace(/^mangak:/, '').replace(/^\//, '');
    const mangaUrl = `https://mangak.io/${slug}`;

    try {
      const html = await this.fetchRawHtml(mangaUrl);
      const nextData = this.extractNextData(html);
      const rawManga = nextData?.props?.pageProps?.initialManga;

      if (rawManga) {
        const mapped = this.mapRawManga(rawManga);
        if (mapped) {
          const authorList: string[] = [];
          if (Array.isArray(rawManga.authors)) {
            for (const a of rawManga.authors) {
              if (a.name) authorList.push(a.name);
            }
          }
          mapped.authors = authorList;
          return mapped;
        }
      }
    } catch {
      // Fallback
    }

    const fallback = (fallbackCatalog as unknown as SourceManga[]).find(
      (m) => m.id === manga.id || m.url === `/${slug}` || m.url === slug
    );
    if (fallback) return fallback;

    return {
      ...manga,
      id: `mangak:${slug}`,
      sourceId: this.metadata.id,
      title: manga.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      url: `/${slug}`,
      publicUrl: mangaUrl,
      coverUrl: manga.coverUrl || '',
      coverHeaders: this.getRequestHeaders(),
      state: 'ongoing',
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const rawId = manga.url || manga.id;
    const slug = rawId.replace(/^mangak:/, '').replace(/^\//, '');
    const mangaUrl = `https://mangak.io/${slug}`;

    try {
      const html = await this.fetchRawHtml(mangaUrl);
      const nextData = this.extractNextData(html);
      const rawManga = nextData?.props?.pageProps?.initialManga;

      if (rawManga && Array.isArray(rawManga.chapters) && rawManga.chapters.length > 0) {
        return rawManga.chapters.map((ch: any, idx: number) => {
          const chUrl = ch.url || `/${slug}/${ch.slug}`;
          const cleanPath = chUrl.startsWith('/') ? chUrl : `/${chUrl}`;
          return {
            id: `mangak:${cleanPath.replace(/^\//, '')}`,
            sourceId: this.metadata.id,
            mangaId: manga.id,
            name: ch.name || `Chapter ${ch.number || idx + 1}`,
            number: Number(ch.number) || (rawManga.chapters.length - idx),
            url: cleanPath,
          };
        });
      }
    } catch {
      // Fallback
    }

    return [];
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const rawId = (chapter.url || chapter.id).replace(/^mangak:/, '');
    const path = rawId.startsWith('/') ? rawId : `/${rawId}`;
    const chapterUrl = `https://mangak.io${path}`;

    try {
      const html = await this.fetchRawHtml(chapterUrl);
      const nextData = this.extractNextData(html);
      const initialChapter = nextData?.props?.pageProps?.initialChapter;

      const pagesList: SourcePage[] = [];

      // 1. Check pages array in initialChapter
      if (initialChapter && Array.isArray(initialChapter.pages) && initialChapter.pages.length > 0) {
        initialChapter.pages.forEach((p: any, idx: number) => {
          if (p.url) {
            pagesList.push({
              index: idx,
              url: p.url,
              headers: {
                Referer: 'https://mangak.io/',
                'User-Agent': DEFAULT_USER_AGENT,
              },
            });
          }
        });
      }

      // 2. Check images string array in initialChapter
      if (pagesList.length === 0 && initialChapter && Array.isArray(initialChapter.images) && initialChapter.images.length > 0) {
        initialChapter.images.forEach((imgUrl: string, idx: number) => {
          pagesList.push({
            index: idx,
            url: imgUrl,
            headers: {
              Referer: 'https://mangak.io/',
              'User-Agent': DEFAULT_USER_AGENT,
            },
          });
        });
      }

      // 3. Fallback: parse img[src*="rx.qvzr"] from DOM
      if (pagesList.length === 0) {
        const imgRegex = /<img[^>]+src=["'](https:\/\/rx\.qvzr[^"']+)["']/g;
        let match;
        const seenUrls = new Set<string>();
        while ((match = imgRegex.exec(html)) !== null) {
          const imgUrl = match[1];
          if (!seenUrls.has(imgUrl)) {
            seenUrls.add(imgUrl);
            pagesList.push({
              index: pagesList.length,
              url: imgUrl,
              headers: {
                Referer: 'https://mangak.io/',
                'User-Agent': DEFAULT_USER_AGENT,
              },
            });
          }
        }
      }

      if (pagesList.length > 0) {
        return pagesList;
      }
    } catch (err: any) {
      console.warn(`[MangaKParser] Failed to get pages for chapter ${chapter.id}:`, err?.message || err);
    }

    return [];
  }
}
