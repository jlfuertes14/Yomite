/**
 * Comix.to Parser
 *
 * Scrapes manga catalog, details, chapters, and reader pages from comix.to.
 * Implements HTML parsing with Cheerio-compatible selectors matching comix.to's DOM:
 * - Browse / Search: /browse?q={query}&sort={sort}&page={page}
 * - Title Detail: /title/{id}-{slug}
 * - Chapter List: a.mchap-row__primary
 * - Reader Pages: img.rpage__img, .rpage-item img
 */
import { BaseParser } from './BaseParser';
import {
  MangaSourceMetadata,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
} from '../types';
import { DEFAULT_USER_AGENT } from '../network/httpClient';

export class ComixToParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'comix-to',
      name: 'Comix',
      domain: 'comix.to',
      baseUrl: 'https://comix.to',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=comix.to&sz=64',
      description: 'Massive library of manga, manhwa, and comics from Comix.to.',
      availableSortOrders: ['popular', 'latest', 'alphabetical', 'rating'],
      enabled: true,
      ...metadata,
    };
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let url: string;

    if (filter.query?.trim()) {
      const q = encodeURIComponent(filter.query.trim());
      url = `${this.metadata.baseUrl}/browse?q=${q}&page=${page}`;
    } else {
      let sort = 'views:desc';
      if (filter.order === 'latest') sort = 'updated_at:desc';
      else if (filter.order === 'rating') sort = 'rating:desc';
      else if (filter.order === 'alphabetical') sort = 'title:asc';
      else if (filter.order === 'popular') sort = 'views:desc';

      url = `${this.metadata.baseUrl}/browse?sort=${sort}&page=${page}`;
    }

    const $ = await this.fetchHtml(url);
    const results: SourceManga[] = [];
    const seen = new Set<string>();

    $('a[href*="/title/"]').each((_, el) => {
      const href = el.attr('href') || '';
      // Exclude chapter links e.g. /title/.../...-chapter-...
      if (!href || href.includes('-chapter-') || href.includes('/chapter/')) return;
      const slugMatch = href.match(/\/title\/([a-z0-9]+-[^/?#]+)/i);
      if (!slugMatch) return;
      const slug = slugMatch[1];
      if (seen.has(slug)) return;
      seen.add(slug);

      const title = this.cleanText(
        el.find('h3, h4, .title, .mpage__title, span').first().text() ||
        el.attr('title') ||
        el.find('img').first().attr('alt') ||
        this.titleFromSlug(slug)
      );

      if (!title || /chapter/i.test(title)) return;

      const img = el.find('img').first();
      const coverUrl = img.attr('src') || img.attr('data-src') || null;

      results.push({
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        url: `${this.metadata.baseUrl}/title/${slug}`,
        publicUrl: `${this.metadata.baseUrl}/title/${slug}`,
        title,
        coverUrl: coverUrl ? this.toAbsoluteUrl(coverUrl) : null,
      });
    });

    return results;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const url = this.toTitleUrl(manga.url);
    const $ = await this.fetchHtml(url);

    const title = this.cleanText(
      $('h1.mpage__title, .mpage__title, h1').first().text() ||
      manga.title
    );

    const cover =
      $('img.mpage__poster, .mpage__poster img').first().attr('src') ||
      $('img.mpage__poster, .mpage__poster img').first().attr('data-src') ||
      manga.coverUrl;

    const description = this.cleanText(
      $('.mpage__desc, .mpage__synopsis, [class*="desc"]').first().text()
    );

    const chapters = this.parseChapterLinks($, manga.id, url);

    const tags: string[] = [];
    $('a[href*="/genre/"], a[href*="/tag/"], .badge, .genre').each((_, el) => {
      const tagText = this.cleanText(el.text());
      if (tagText && !tags.includes(tagText)) tags.push(tagText);
    });

    return {
      ...manga,
      title,
      url,
      publicUrl: url,
      coverUrl: cover ? this.toAbsoluteUrl(cover) : manga.coverUrl,
      description: description || manga.description,
      chaptersCount: chapters.length || manga.chaptersCount,
      tags: tags.length ? tags : manga.tags,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const url = this.toTitleUrl(manga.url);
    const $ = await this.fetchHtml(url);
    return this.parseChapterLinks($, manga.id, url);
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const raw = chapter.url || chapter.id.replace(/^[^:]+:/, '');
    const url = this.toChapterUrl(raw);
    const $ = await this.fetchHtml(url);
    const pages: SourcePage[] = [];
    const seen = new Set<string>();

    $('img.rpage__img, .rpage-item img, .rpage__main img, #viewer img, .reader img').each((index, el) => {
      const src =
        el.attr('data-src') ||
        el.attr('data-lazy-src') ||
        el.attr('src') ||
        '';
      if (src && !src.includes('data:image') && !/logo|avatar|icon|banner|placeholder/i.test(src)) {
        const absUrl = this.toAbsoluteUrl(src);
        if (!seen.has(absUrl)) {
          seen.add(absUrl);
          pages.push({
            index: pages.length,
            url: absUrl,
            headers: this.getRequestHeaders(),
          });
        }
      }
    });

    // Check embedded JSON or script if no images found directly
    if (!pages.length) {
      const html = $.root.innerHTML || '';
      const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:webp|jpg|jpeg|png)(?:\?[^\s"'<>]*)?/gi;
      let idx = 0;
      for (const match of html.matchAll(imgRegex)) {
        const u = match[0];
        if (/\/chapters?\/|\/pages?\/|\/upload\//i.test(u) && !seen.has(u)) {
          seen.add(u);
          pages.push({
            index: idx++,
            url: u,
            headers: this.getRequestHeaders(),
          });
        }
      }
    }

    return pages;
  }

  private parseChapterLinks($: any, mangaId: string, baseUrl: string): SourceChapter[] {
    const chapters: SourceChapter[] = [];
    const seen = new Set<string>();

    $('a.mchap-row__primary, a[href*="/title/"][href*="-chapter-"]').each((_, el) => {
      const href = el.attr('href') || '';
      if (!href) return;
      const url = this.toAbsoluteUrl(href, baseUrl);
      if (seen.has(url)) return;
      seen.add(url);

      const titleMatch = url.match(/\/title\/([^/]+)\/([^/?#]+)/i);
      const comicSlug = titleMatch?.[1] || '';
      const chapterSlug = titleMatch?.[2] || '';

      const number = this.parseChapterNumber(el.text()) || this.parseChapterNumber(chapterSlug);
      const name = this.cleanText(el.text()) || `Chapter ${number}`;

      const groupName = this.cleanText(el.parent().find('a.mchap-row__group, .group').first().text()) || 'Comix';

      chapters.push({
        id: `${this.metadata.id}:${comicSlug}:${chapterSlug}`,
        sourceId: this.metadata.id,
        mangaId,
        url,
        name,
        number,
        scanlator: groupName,
      });
    });

    return chapters;
  }

  private toTitleUrl(slugOrUrl: string): string {
    if (/^https?:\/\//i.test(slugOrUrl)) return slugOrUrl;
    const clean = slugOrUrl.replace(/^[^:]+:/, '').replace(/^\/+/, '');
    if (clean.startsWith('title/')) {
      return `${this.metadata.baseUrl}/${clean}`;
    }
    return `${this.metadata.baseUrl}/title/${clean}`;
  }

  private toChapterUrl(rawIdOrUrl: string): string {
    if (/^https?:\/\//i.test(rawIdOrUrl)) return rawIdOrUrl;
    const parts = rawIdOrUrl.split(':');
    if (parts.length >= 3) {
      const comicSlug = parts[parts.length - 2];
      const chSlug = parts[parts.length - 1];
      return `${this.metadata.baseUrl}/title/${comicSlug}/${chSlug}`;
    }
    const clean = rawIdOrUrl.replace(/^\/+/, '');
    if (clean.startsWith('title/')) {
      return `${this.metadata.baseUrl}/${clean}`;
    }
    return `${this.metadata.baseUrl}/title/${clean}`;
  }

  private titleFromSlug(slug: string): string {
    const withoutId = slug.replace(/^[a-z0-9]+-/i, '');
    return withoutId
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
