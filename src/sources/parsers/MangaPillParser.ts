/**
 * MangaPill Parser
 * Ported from Kotatsu's site/en/MangaPill.kt
 * Fast, reliable Go/HTML manga platform
 */
import { BaseParser } from './BaseParser';
import {
  MangaSourceMetadata,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
} from '../types';
import { sourceHttpClient, DEFAULT_USER_AGENT } from '../network/httpClient';

export class MangaPillParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;
  private readonly baseUrl = 'https://mangapill.com';

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: 'https://mangapill.com/',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    };
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let url = `${this.baseUrl}/search?status=publishing&page=${page}`;

    if (filter.query && filter.query.trim().length > 0) {
      url = `${this.baseUrl}/search?q=${encodeURIComponent(filter.query.trim())}&page=${page}`;
    } else if (filter.tags && filter.tags.length > 0) {
      url = `${this.baseUrl}/search?genre=${encodeURIComponent(filter.tags[0])}&page=${page}`;
    }

    const $ = await sourceHttpClient.fetchHtml(url, {
      sourceId: this.metadata.name,
      referer: 'https://mangapill.com/',
    });

    const mangas: SourceManga[] = [];
    const linkEls = $.root.querySelectorAll('a.relative.block');

    for (const link of linkEls) {
      const href = link.getAttribute('href');
      if (!href) continue;

      const img = link.querySelector('img');
      const coverUrl = img?.getAttribute('data-src') || img?.getAttribute('src') || null;
      const titleEl = link.parentNode?.querySelector(
        'div.mt-3.font-black.leading-tight.line-clamp-2'
      );
      const title = titleEl?.text?.trim() || img?.getAttribute('alt')?.trim() || 'Unknown';

      const cleanPath = href.replace(/^\//, '');
      mangas.push({
        id: `${this.metadata.id}:${cleanPath}`,
        sourceId: this.metadata.id,
        title: this.cleanText(title),
        url: href.startsWith('/') ? href : `/${href}`,
        publicUrl: `${this.baseUrl}${href.startsWith('/') ? href : `/${href}`}`,
        coverUrl,
        coverHeaders: { Referer: 'https://mangapill.com/' },
      });
    }

    return mangas;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const path = manga.url.startsWith('/') ? manga.url : `/${manga.url}`;
    const url = `${this.baseUrl}${path}`;

    const $ = await sourceHttpClient.fetchHtml(url, {
      sourceId: this.metadata.name,
      referer: 'https://mangapill.com/',
    });

    const description = $.root.querySelector('p.text-sm.text--secondary')?.text?.trim();
    const altTitle = $.root.querySelector('div.text-sm.text-secondary')?.text?.trim();

    // Tags
    const tags: string[] = [];
    $.root.querySelectorAll('a[href^="/search?genre="]').forEach((el) => {
      const tagText = el.text?.trim();
      if (tagText && !tags.includes(tagText)) tags.push(tagText);
    });

    // Status
    let state: SourceManga['state'] = undefined;
    const labels = $.root.querySelectorAll('label.text-secondary');
    for (const label of labels) {
      if (label.text?.trim() === 'Status') {
        const next = label.nextElementSibling?.text?.trim().toLowerCase();
        if (next === 'publishing') state = 'ongoing';
        else if (next === 'finished') state = 'completed';
        else if (next === 'discontinued') state = 'abandoned';
        break;
      }
    }

    return {
      ...manga,
      description: description || manga.description,
      altTitles: altTitle ? [altTitle] : manga.altTitles,
      tags: tags.length ? tags : manga.tags,
      state: state || manga.state,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const path = manga.url.startsWith('/') ? manga.url : `/${manga.url}`;
    const url = `${this.baseUrl}${path}`;

    const $ = await sourceHttpClient.fetchHtml(url, {
      sourceId: this.metadata.name,
      referer: 'https://mangapill.com/',
    });

    const chapters: SourceChapter[] = [];
    const chapterEls = $.root.querySelectorAll('div#chapters a');

    // MangaPill lists chapters from newest to oldest in HTML
    chapterEls.forEach((el, idx) => {
      const href = el.getAttribute('href');
      if (!href) return;

      const name = el.text?.trim() || `Chapter ${chapterEls.length - idx}`;
      const numMatch = name.match(/Chapter\s+([\d.]+)/i);
      const number = numMatch ? parseFloat(numMatch[1]) : chapterEls.length - idx;

      const cleanPath = href.replace(/^\//, '');
      chapters.push({
        id: `${this.metadata.id}:${cleanPath}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name,
        number,
        url: href.startsWith('/') ? href : `/${href}`,
      });
    });

    // Sort ascending (Chapter 1, 2, 3...)
    return chapters.reverse();
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const path = chapter.url.startsWith('/') ? chapter.url : `/${chapter.url}`;
    const url = `${this.baseUrl}${path}`;

    const $ = await sourceHttpClient.fetchHtml(url, {
      sourceId: this.metadata.name,
      referer: 'https://mangapill.com/',
    });

    const pages: SourcePage[] = [];
    const imgEls = $.root.querySelectorAll('img.js-page');

    imgEls.forEach((img, idx) => {
      const src = img.getAttribute('data-src') || img.getAttribute('src');
      if (src) {
        pages.push({
          index: idx,
          url: src,
          headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            Referer: 'https://mangapill.com/',
          },
        });
      }
    });

    return pages;
  }
}
