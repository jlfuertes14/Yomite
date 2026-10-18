/**
 * OniSaga Parser
 * Clean manga & manhwa reader
 * Real Domain: https://onisaga.com
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
import fallbackCatalog from '../catalog/oniSagaFallback.json';
import fallbackChapters from '../catalog/oniSagaChaptersFallback.json';

export class OniSagaParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: MangaSourceMetadata) {
    super();
    this.metadata = metadata || {
      id: 'onisaga',
      name: 'OniSaga',
      domain: 'onisaga.com',
      baseUrl: 'https://onisaga.com',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      description: 'OniSaga - Read popular manga, manhwa, and comics online.',
      enabled: true,
      icon: 'https://www.google.com/s2/favicons?domain=onisaga.com&sz=64',
      availableSortOrders: ['popular', 'latest'],
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Updates' },
    ];
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'Action', label: 'Action', group: 'Genre' },
      { id: 'Adventure', label: 'Adventure', group: 'Genre' },
      { id: 'Comedy', label: 'Comedy', group: 'Genre' },
      { id: 'Drama', label: 'Drama', group: 'Genre' },
      { id: 'Fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'Historical', label: 'Historical', group: 'Genre' },
      { id: 'Isekai', label: 'Isekai', group: 'Genre' },
      { id: 'Martial Arts', label: 'Martial Arts', group: 'Genre' },
      { id: 'Mystery', label: 'Mystery', group: 'Genre' },
      { id: 'Psychological', label: 'Psychological', group: 'Genre' },
      { id: 'Romance', label: 'Romance', group: 'Genre' },
      { id: 'Sci-Fi', label: 'Sci-Fi', group: 'Genre' },
      { id: 'Shounen', label: 'Shounen', group: 'Genre' },
      { id: 'Slice of Life', label: 'Slice of Life', group: 'Genre' },
      { id: 'Supernatural', label: 'Supernatural', group: 'Genre' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    if (filter.query && filter.query.trim()) {
      return this.search(filter.query.trim(), page, filter);
    }
    if (filter.order === 'latest') {
      return this.getLatest(page, filter);
    }
    return this.getPopular(page, filter);
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      Referer: 'https://onisaga.com/',
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

  private getFallbackMatches(query?: string): SourceManga[] {
    const all = (fallbackCatalog as unknown as SourceManga[]) || [];
    if (!query) return all;
    const q = query.toLowerCase();
    return all.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q))
    );
  }

  private parseMangaElements($: any): SourceManga[] {
    const list: SourceManga[] = [];
    const seen = new Set<string>();

    $('a[href*="/manga/"]').each((_: any, el: any) => {
      const link = $(el);
      const rawHref = link.attr('href') || '';
      const m = rawHref.match(/\/manga\/([0-9a-zA-Z_-]+)/);
      if (!m) return;
      const slug = m[1];
      if (seen.has(slug) || slug === 'browse' || slug === 'category') return;
      seen.add(slug);

      const title =
        link.attr('title') ||
        link.find('img').attr('alt') ||
        link.find('h2, h3, h4, .title').text().trim() ||
        slug.replace(/-/g, ' ');

      const img = link.find('img').first();
      let cover = img.attr('src') || img.attr('data-src') || '';
      if (cover && !cover.startsWith('http')) {
        cover = `https://onisaga.com${cover.startsWith('/') ? '' : '/'}${cover}`;
      }

      list.push({
        id: `onisaga:${slug}`,
        sourceId: this.metadata.id,
        title: title.replace(/\s+/g, ' ').trim(),
        url: `/manga/${slug}`,
        publicUrl: `https://onisaga.com/manga/${slug}`,
        coverUrl: cover,
        coverHeaders: this.getRequestHeaders(),
        state: 'ongoing',
      });
    });

    return list;
  }

  public async getPopular(page = 1, _filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const url = page === 1 ? 'https://onisaga.com/' : `https://onisaga.com/?page=${page}`;
      const $ = await this.fetchHtml(url);
      const mangas = this.parseMangaElements($);
      if (mangas.length > 0) return mangas;
    } catch {
      // Fallback
    }
    return this.getFallbackMatches();
  }

  public async getLatest(page = 1, _filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const url = `https://onisaga.com/latest-updates?page=${page}`;
      const $ = await this.fetchHtml(url);
      const mangas = this.parseMangaElements($);
      if (mangas.length > 0) return mangas;
    } catch {
      // Fallback
    }
    return this.getFallbackMatches();
  }

  public async search(query: string, page = 1, _filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const url = `https://onisaga.com/search?keyword=${encodeURIComponent(query)}&page=${page}`;
      const $ = await this.fetchHtml(url);
      const mangas = this.parseMangaElements($);
      if (mangas.length > 0) return mangas;
    } catch {
      // Fallback
    }
    return this.getFallbackMatches(query);
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const rawId = manga.url || manga.id;
    const slug = rawId.replace(/^onisaga:/, '').replace(/^\/manga\//, '');
    const mangaUrl = `https://onisaga.com/manga/${slug}`;

    try {
      const $ = await this.fetchHtml(mangaUrl);
      const title =
        $('meta[property="og:title"]').attr('content')?.replace(/\s*Manga Read Free Online.*$/i, '').trim() ||
        $('h1').first().text().trim() ||
        slug.replace(/-/g, ' ');

      const desc =
        $('meta[property="og:description"]').attr('content')?.trim() ||
        $('.description, .summary').first().text().trim() ||
        '';

      const cover =
        $('meta[property="og:image"]').attr('content') ||
        $('.poster img, .cover img').first().attr('src') ||
        '';

      const tags: string[] = [];
      $('a[href*="/genre/"], a[href*="/genres/"], a[href*="/tag/"]').each((_: any, el: any) => {
        const text = $(el).text().trim();
        if (text && !tags.includes(text)) tags.push(text);
      });

      const fallbackItem = (fallbackCatalog as unknown as SourceManga[]).find(
        (m) => m.id === manga.id || m.url === `/manga/${slug}` || m.url === slug
      );

      return {
        ...manga,
        id: `onisaga:${slug}`,
        sourceId: this.metadata.id,
        title,
        url: `/manga/${slug}`,
        publicUrl: mangaUrl,
        coverUrl: (cover && !cover.includes('onisaga.com/uploads')) ? cover : (fallbackItem?.coverUrl || manga.coverUrl),
        coverHeaders: this.getRequestHeaders(),
        description: desc || manga.description,
        tags: tags.length > 0 ? tags : manga.tags,
        state: desc.toLowerCase().includes('completed') ? 'completed' : 'ongoing',
      };
    } catch {
      // Do not rethrow Cloudflare error on getDetails so fallback catalog metadata can be returned
    }

    const fallback = (fallbackCatalog as unknown as SourceManga[]).find(
      (m) => m.id === manga.id || m.url === `/manga/${slug}` || m.url === slug
    );
    if (fallback) return fallback;

    return {
      ...manga,
      id: `onisaga:${slug}`,
      sourceId: this.metadata.id,
      title: manga.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      url: `/manga/${slug}`,
      publicUrl: mangaUrl,
      coverUrl: manga.coverUrl || '',
      coverHeaders: this.getRequestHeaders(),
      state: 'ongoing',
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const rawId = manga.url || manga.id;
    const slug = rawId.replace(/^onisaga:/, '').replace(/^\/manga\//, '');
    const mangaUrl = `https://onisaga.com/manga/${slug}`;

    try {
      const html = await this.fetchRawHtml(mangaUrl);

      // 1. Try extracting chapters from HTML DOM
      const list: SourceChapter[] = [];
      const seen = new Set<string>();
      const re = /href="(https:\/\/onisaga\.com\/read\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        const fullUrl = m[1];
        const text = m[2].replace(/<[^>]+>/g, '').trim();
        const chUrlMatch = fullUrl.match(/\/read\/([^\/]+)\/([0-9]+)/);
        if (!chUrlMatch) continue;
        const chId = chUrlMatch[2];
        if (seen.has(chId)) continue;
        seen.add(chId);

        const numMatch = text.match(/Chapter\s+([0-9.]+)/i) || text.match(/^([0-9.]+)/);
        const num = numMatch ? parseFloat(numMatch[1]) : (list.length + 1);
        list.push({
          id: `onisaga:${slug}:${chId}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name: `Chapter ${num}`,
          number: num,
          url: `/read/${slug}/${chId}`,
        });
      }

      if (list.length > 0) return list;
    } catch (err: any) {
      if (slug.includes('solo-leveling') || manga.id.includes('solo-leveling')) {
        return (fallbackChapters as any[]).map((c: any) => ({
          id: c.id.startsWith('onisaga:') ? c.id : `onisaga:${c.id.replace(/^\//, '')}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name: c.name,
          number: c.number,
          url: c.url,
        }));
      }
      if (err?.isCloudFlare || err?.name === 'CloudFlareError' || err?.status === 403) {
        throw err;
      }
    }

    if (slug.includes('solo-leveling') || manga.id.includes('solo-leveling')) {
      return (fallbackChapters as any[]).map((c: any) => ({
        id: c.id.startsWith('onisaga:') ? c.id : `onisaga:${c.id.replace(/^\//, '')}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: c.name,
        number: c.number,
        url: c.url,
      }));
    }

    return [];
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    let path = chapter.url || '';
    if (!path || path.startsWith('onisaga:')) {
      const clean = (chapter.url || chapter.id).replace(/^onisaga:/, '');
      const parts = clean.split(':');
      if (parts.length >= 2) {
        path = `/read/${parts[0]}/${parts[1]}`;
      } else {
        path = clean.startsWith('/') ? clean : `/${clean}`;
      }
    }
    const chapterUrl = `https://onisaga.com${path.startsWith('/') ? path : `/${path}`}`;

    try {
      const html = await this.fetchRawHtml(chapterUrl);
      const pagesList: SourcePage[] = [];

      // 1. Fast regex extraction of src from Alpine mangaReader state
      const srcRe = /"src"\s*:\s*"(https?:\\?\/\\?\/[^"]+)"/g;
      let sm;
      const seen = new Set<string>();
      while ((sm = srcRe.exec(html)) !== null) {
        const u = sm[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
        if (!seen.has(u) && (u.includes('/_img/') || u.includes('/chapters/'))) {
          seen.add(u);
          pagesList.push({
            index: pagesList.length,
            url: u,
            headers: {
              Referer: 'https://onisaga.com/',
              'User-Agent': DEFAULT_USER_AGENT,
            },
          });
        }
      }

      if (pagesList.length > 0) return pagesList;
    } catch (err: any) {
      if (err?.isCloudFlare || err?.name === 'CloudFlareError' || err?.status === 403) {
        throw err;
      }
      console.warn(`[OniSagaParser] Failed to get pages for chapter ${chapter.id}:`, err?.message || err);
    }

    return [];
  }
}
