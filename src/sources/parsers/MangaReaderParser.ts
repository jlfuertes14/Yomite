/**
 * MangaReader Engine Parser
 * Ported from Kotatsu's site/mangareader/MangaReaderParser.kt
 * Powers 260+ scanlation and aggregator websites.
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

export class MangaReaderParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: this.metadata.baseUrl,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    };
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let url: string;

    if (filter.query && filter.query.trim().length > 0) {
      const q = encodeURIComponent(filter.query.trim());
      url = `${this.metadata.baseUrl}/page/${page}/?s=${q}`;
    } else {
      let order = 'popular';
      if (filter.order === 'latest') order = 'update';
      else if (filter.order === 'newest') order = 'latest';
      else if (filter.order === 'alphabetical') order = 'title';

      url = `${this.metadata.baseUrl}/manga/?order=${order}&page=${page}`;
    }

    let $;
    try {
      $ = await this.fetchHtml(url);
    } catch (err: any) {
      // Fallback for sites where /manga/?order= is /manga?page=
      if (err.response?.status === 404) {
        url = `${this.metadata.baseUrl}/manga?page=${page}`;
        $ = await this.fetchHtml(url);
      } else {
        throw err;
      }
    }

    const mangaList: SourceManga[] = [];

    // MangaReader theme item selectors
    const items = $('.postbody .listupd .bs .bsx, .listupd .bs .bsx, .bs .bsx, .flw-item');

    items.each((_, el) => {
      const item = $(el);
      const link = item.find('a').first();
      const href = link.attr('href') || '';

      const titleEl = item.find('div.tt, a[title], .film-name a, h4, h3').first();
      const title = this.cleanText(titleEl.text() || link.attr('title') || '');

      const img = item.find('img.ts-post-image, img.film-poster-img, img').first();
      const cover =
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        img.attr('data-original') ||
        img.attr('src') ||
        null;

      const ratingStr = item.find('.numscore, .rating, .score').first().text();
      const rating = ratingStr ? parseFloat(ratingStr) : undefined;

      if (href && title) {
        mangaList.push({
          id: `${this.metadata.id}:${href}`,
          sourceId: this.metadata.id,
          title,
          url: href,
          publicUrl: href.startsWith('http') ? href : this.toAbsoluteUrl(href),
          coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : null,
          rating,
          state: 'ongoing',
        });
      }
    });

    return mangaList;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const fullUrl = manga.url.startsWith('http') ? manga.url : this.toAbsoluteUrl(manga.url);
    const $ = await this.fetchHtml(fullUrl);

    const title =
      this.cleanText($('h1.entry-title, .entry-title, h1').first().text()) || manga.title;

    const coverEl = $('.thumb img, .infox img, img.wp-post-image').first();
    const cover =
      coverEl.attr('data-src') ||
      coverEl.attr('data-lazy-src') ||
      coverEl.attr('data-original') ||
      coverEl.attr('src') ||
      manga.coverUrl;

    const desc = this.cleanText($('.entry-content, .wd-full, .description, .synopsis').first().text());

    const author = this.cleanText(
      $('.tsinfo .imptdt:contains(Author) i, .fmed:contains(Author) span').first().text()
    );

    const genres: string[] = [];
    $('.mgen a, .genres-container a').each((_, el) => {
      const g = this.cleanText($(el).text());
      if (g && !genres.includes(g)) genres.push(g);
    });

    const statusText = $('.tsinfo .imptdt:contains(Status) i').first().text().toLowerCase();
    const state = statusText.includes('complete') ? 'completed' : 'ongoing';

    return {
      ...manga,
      title,
      coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : null,
      description: desc || undefined,
      authors: author ? [author] : undefined,
      tags: genres.slice(0, 15),
      state,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const fullUrl = manga.url.startsWith('http') ? manga.url : this.toAbsoluteUrl(manga.url);
    const $ = await this.fetchHtml(fullUrl);
    const chapters: SourceChapter[] = [];

    $('#chapterlist li, ul.clstyle li').each((_, el) => {
      const item = $(el);
      const link = item.find('a').first();
      const href = link.attr('href') || '';
      const name = this.cleanText(item.find('.chapternum, .chap-title').text() || link.text());
      const num = this.parseChapterNumber(name);
      const dateStr = item.find('.chapterdate').text();
      const releaseDate = this.parseDate(dateStr) || undefined;

      if (href && name) {
        chapters.push({
          id: `${this.metadata.id}:${href}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name,
          number: num,
          url: href,
          dateUpload: releaseDate,
        });
      }
    });

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const fullUrl = chapter.url.startsWith('http') ? chapter.url : this.toAbsoluteUrl(chapter.url);
    const $ = await this.fetchHtml(fullUrl);
    const pages: SourcePage[] = [];

    $('#readerarea img').each((index, el) => {
      const img = $(el);
      const src =
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        img.attr('data-original') ||
        img.attr('src') ||
        '';

      if (src && !src.includes('data:image')) {
        pages.push({
          index,
          url: src.startsWith('http') ? src : this.toAbsoluteUrl(src),
          headers: this.getRequestHeaders(),
        });
      }
    });

    return pages;
  }
}
