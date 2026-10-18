/**
 * WeebCentral Parser
 * Successor to MangaSee / MangaLife
 * Real Domain: https://weebcentral.com
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
import { DEFAULT_USER_AGENT } from '../network/httpClient';
import fallbackCatalog from '../catalog/weebCentralFallback.json';

export class WeebCentralParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: MangaSourceMetadata) {
    super();
    this.metadata = metadata || {
      id: 'weebcentral',
      name: 'Weeb Central',
      domain: 'weebcentral.com',
      baseUrl: 'https://weebcentral.com',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      description: 'Weeb Central - Read manga, manhwa, and comics online for free.',
      enabled: true,
      icon: 'https://www.google.com/s2/favicons?domain=weebcentral.com&sz=64',
      availableSortOrders: ['popular', 'latest', 'alphabetical'],
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Updates' },
      { id: 'alphabetical', label: 'Alphabetical' },
    ];
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'Action', label: 'Action', group: 'Genre' },
      { id: 'Adventure', label: 'Adventure', group: 'Genre' },
      { id: 'Comedy', label: 'Comedy', group: 'Genre' },
      { id: 'Drama', label: 'Drama', group: 'Genre' },
      { id: 'Fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'Horror', label: 'Horror', group: 'Genre' },
      { id: 'Mystery', label: 'Mystery', group: 'Genre' },
      { id: 'Psychological', label: 'Psychological', group: 'Genre' },
      { id: 'Romance', label: 'Romance', group: 'Genre' },
      { id: 'Sci-Fi', label: 'Sci-Fi', group: 'Genre' },
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
      Referer: 'https://weebcentral.com/',
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    };
  }

  private parseMangaArticles($: any): SourceManga[] {
    const list: SourceManga[] = [];
    const seen = new Set<string>();

    $('article').each((_: any, el: any) => {
      const card = $(el);
      const link = card.find('a[href*="/series/"]').first();
      const rawHref = link.attr('href') || '';
      if (!rawHref || rawHref.includes('/full-chapter-list')) return;

      const m = rawHref.match(/\/series\/([0-9a-zA-Z]+)(?:\/([^/?#]+))?/);
      if (!m) return;
      const seriesId = m[1];
      const slug = m[2] || '';

      if (seen.has(seriesId)) return;
      seen.add(seriesId);

      // Cover image
      const img = card.find('img').first();
      let cover = img.attr('src') || img.attr('data-src') || '';
      if (!cover) {
        const source = card.find('source').first();
        cover = source.attr('srcset') || '';
      }
      if (!cover) {
        cover = `https://temp.compsci88.com/cover/normal/${seriesId}.webp`;
      }

      // Title
      let title = card.attr('data-tip')?.trim() || '';
      if (!title || /^official/i.test(title)) {
        const alt = img.attr('alt')?.replace(/\s*cover$/i, '').trim();
        if (alt && !/^official/i.test(alt)) {
          title = alt;
        }
      }
      if (!title || /^official/i.test(title)) {
        const candidates = card.find('div.truncate.font-semibold, div.font-semibold, h2, h3, a.font-bold, .line-clamp-1, .line-clamp-2');
        candidates.each((_: any, cel: any) => {
          const t = $(cel).text().trim();
          if (
            t &&
            !/^official/i.test(t) &&
            !/^chapter/i.test(t) &&
            !/^episode/i.test(t) &&
            (!title || /^official/i.test(title))
          ) {
            title = t;
          }
        });
      }
      if (!title || /^official/i.test(title)) {
        title = slug ? slug.replace(/-/g, ' ') : this.cleanText(link.text());
      }

      list.push({
        id: `${this.metadata.id}:${seriesId}`,
        sourceId: this.metadata.id,
        title,
        url: `/series/${seriesId}/${slug}`,
        publicUrl: `https://weebcentral.com/series/${seriesId}/${slug}`,
        coverUrl: cover.startsWith('http') ? cover : `${this.metadata.baseUrl}${cover}`,
        coverHeaders: {
          Referer: 'https://weebcentral.com/',
          'User-Agent': DEFAULT_USER_AGENT,
        },
        state: 'ongoing',
      });
    });

    return list;
  }

  public async getPopular(page: number = 1, filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const url = `${this.metadata.baseUrl}/search/data?sort=Popularity&order=Descending&page=${page}`;
      const $ = await this.fetchHtml(url);
      const results = this.parseMangaArticles($);
      if (results.length > 0) return results;
    } catch {
      // Fallback
    }
    return (fallbackCatalog as SourceManga[]).slice((page - 1) * 24, page * 24);
  }

  public async getLatest(page: number = 1, filter?: SourceFilter): Promise<SourceManga[]> {
    try {
      const url = `${this.metadata.baseUrl}/search/data?sort=Latest%20Updates&order=Descending&page=${page}`;
      const $ = await this.fetchHtml(url);
      const results = this.parseMangaArticles($);
      if (results.length > 0) return results;
    } catch {
      // Fallback
    }
    return (fallbackCatalog as SourceManga[]).slice((page - 1) * 24, page * 24);
  }

  public async search(query: string, page: number = 1, filter?: SourceFilter): Promise<SourceManga[]> {
    const q = query.trim();
    if (!q) {
      return this.getPopular(page, filter);
    }

    try {
      const url = `${this.metadata.baseUrl}/search/data?text=${encodeURIComponent(q)}&page=${page}`;
      const $ = await this.fetchHtml(url);
      const results = this.parseMangaArticles($);
      if (results.length > 0) return results;
    } catch {
      // Fallback
    }

    const lowerQ = q.toLowerCase();
    const filtered = (fallbackCatalog as SourceManga[]).filter(
      (m) => m.title.toLowerCase().includes(lowerQ) || m.id.toLowerCase().includes(lowerQ)
    );
    return filtered.slice((page - 1) * 24, page * 24);
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const rawId = manga.id.replace(/^weebcentral:/, '');
    const seriesId = rawId.split('/')[0];
    const fullUrl = manga.url?.startsWith('http')
      ? manga.url
      : `${this.metadata.baseUrl}/series/${seriesId}`;

    try {
      const $ = await this.fetchHtml(fullUrl);
      const titleEl = $('h1').first();
      const title = this.cleanText(titleEl.text()) || manga.title;

      const coverImg = $('img[alt*="cover" i], img[src*="cover"]').first();
      let cover = coverImg.attr('src') || coverImg.attr('data-src') || manga.coverUrl;
      if (!cover || cover.includes('broken_image')) {
        cover = `https://temp.compsci88.com/cover/fallback/${seriesId}.jpg`;
      }

      const descMeta = $('meta[name="description"]').attr('content');
      const descEl = $('.description, .line-clamp-4, p.text-sm').first();
      const description = this.cleanText(descEl.text() || descMeta || '');

      const genres: string[] = [];
      $('a[href*="/search?tag="], a[href*="/genre/"], .badge').each((_: any, el: any) => {
        const t = this.cleanText($(el).text());
        if (t && t.length < 30) genres.push(t);
      });

      return {
        ...manga,
        title,
        coverUrl: cover,
        description,
        tags: genres,
      };
    } catch (err: any) {
      if (err?.isCloudFlare || err?.name === 'CloudFlareError' || err?.status === 403) {
        throw err;
      }
      const fallback = (fallbackCatalog as SourceManga[]).find(
        (m) => m.id === manga.id || m.id === `weebcentral:${seriesId}`
      );
      return fallback || manga;
    }
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const rawId = manga.id.replace(/^weebcentral:/, '');
    const seriesId = rawId.split('/')[0];
    const listUrl = `${this.metadata.baseUrl}/series/${seriesId}/full-chapter-list`;

    let $;
    try {
      $ = await this.fetchHtml(listUrl);
    } catch (err: any) {
      if (err?.isCloudFlare || err?.name === 'CloudFlareError' || err?.status === 403) {
        throw err;
      }
      try {
        $ = await this.fetchHtml(`${this.metadata.baseUrl}/series/${seriesId}`);
      } catch (err2: any) {
        if (err2?.isCloudFlare || err2?.name === 'CloudFlareError' || err2?.status === 403) {
          throw err2;
        }
        return [];
      }
    }

    const chapters: SourceChapter[] = [];
    const seenHrefs = new Set<string>();

    $('a[href*="/chapters/"]').each((_: any, el: any) => {
      const link = $(el);
      const href = link.attr('href') || '';
      if (!href || seenHrefs.has(href)) return;
      seenHrefs.add(href);

      const chMatch = href.match(/\/chapters\/([0-9a-zA-Z]+)/);
      if (!chMatch) return;
      const chapterToken = chMatch[1];

      const text = this.cleanText(link.text());
      let num = 0;
      const numMatch = text.match(/(?:chapter|ch\.?)\s*([\d.]+)/i) || href.match(/chapter[s]?\/([0-9a-zA-Z]+)/i);
      if (numMatch && !isNaN(parseFloat(numMatch[1]))) {
        num = parseFloat(numMatch[1]);
      }

      const timeEl = link.find('time').first();
      const dtAttr = timeEl.attr('datetime');
      let dateUpload: number | null = null;
      if (dtAttr) {
        const parsed = Date.parse(dtAttr);
        if (!isNaN(parsed)) dateUpload = parsed;
      }
      const timeText = timeEl.text().trim();
      if (!dateUpload && timeText) {
        dateUpload = this.parseDateString(timeText);
      }

      let displayName = text;
      if (timeText) {
        displayName = displayName.replace(timeText, '').trim();
      }
      if (displayName.includes('Last Read')) {
        displayName = displayName.split('Last Read')[0].trim();
      }
      if (!displayName || (!displayName.toLowerCase().includes('chapter') && !displayName.toLowerCase().includes('episode'))) {
        displayName = `Chapter ${num || chapterToken}`;
      }

      chapters.push({
        id: `${this.metadata.id}:${seriesId}:${chapterToken}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: displayName,
        number: num,
        url: `/chapters/${chapterToken}`,
        dateUpload,
      });
    });

    // Sort descending by chapter number
    chapters.sort((a, b) => b.number - a.number);
    return chapters;
  }

  private parseDateString(str: string): number | null {
    if (!str) return null;
    const now = Date.now();
    const relMatch = str.match(/^(\d+)\s*(s|sec|m|min|h|hour|d|day|w|week|mo|month|y|year)[a-z]*\s*(?:ago)?$/i);
    if (relMatch) {
      const amount = parseInt(relMatch[1], 10);
      const unit = relMatch[2].toLowerCase();
      if (unit.startsWith('s')) return now - amount * 1000;
      if (unit.startsWith('m') && !unit.startsWith('mo')) return now - amount * 60 * 1000;
      if (unit.startsWith('h')) return now - amount * 3600 * 1000;
      if (unit.startsWith('d')) return now - amount * 86400 * 1000;
      if (unit.startsWith('w')) return now - amount * 7 * 86400 * 1000;
      if (unit.startsWith('mo')) return now - amount * 30 * 86400 * 1000;
      if (unit.startsWith('y')) return now - amount * 365 * 86400 * 1000;
    }
    const parsed = Date.parse(str);
    return isNaN(parsed) ? null : parsed;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const parts = chapter.id.split(':');
    const chapterToken = parts.length >= 3 ? parts[2] : parts[1] || chapter.url?.replace(/^\/chapters\//, '');
    const imagesUrl = `${this.metadata.baseUrl}/chapters/${chapterToken}/images`;

    let $;
    try {
      $ = await this.fetchHtml(imagesUrl);
    } catch (err: any) {
      if (err?.isCloudFlare || err?.name === 'CloudFlareError' || err?.status === 403) {
        throw err;
      }
      const fullChapterUrl = `${this.metadata.baseUrl}/chapters/${chapterToken}`;
      $ = await this.fetchHtml(fullChapterUrl);
    }

    const pages: SourcePage[] = [];
    const seen = new Set<string>();

    $('img').each((_: any, el: any) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (!src || src.includes('brand.png') || src.includes('broken_image') || src.includes('logo')) {
        return;
      }
      if (!seen.has(src)) {
        seen.add(src);
        pages.push({
          index: pages.length,
          url: src,
          headers: {
            Referer: 'https://weebcentral.com/',
            'User-Agent': DEFAULT_USER_AGENT,
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
        });
      }
    });

    return pages;
  }
}
