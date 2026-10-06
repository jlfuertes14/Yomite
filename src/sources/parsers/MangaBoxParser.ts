/**
 * MangaBox Engine Parser (Manganato / Mangakakalot)
 * Ported from Kotatsu's site/mangabox/MangaBoxParser.kt
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

export class MangaBoxParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let url: string;

    if (filter.query && filter.query.trim().length > 0) {
      // Search mode
      const formattedQuery = filter.query
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_');
      url = `${this.metadata.baseUrl}/search/story/${formattedQuery}?page=${page}`;
    } else if (filter.order === 'popular') {
      url = `${this.metadata.baseUrl}/genre-all/${page}?type=topview`;
    } else if (filter.order === 'newest') {
      url = `${this.metadata.baseUrl}/genre-all/${page}?type=newest`;
    } else {
      // Default: Latest updates
      url = `${this.metadata.baseUrl}/genre-all/${page}`;
    }

    const $ = await this.fetchHtml(url);
    const mangaList: SourceManga[] = [];

    // MangaBox items are usually in .content-genres-item or .search-story-item or .list-truyen-item-wrap
    const items = $('.content-genres-item, .search-story-item, .list-truyen-item-wrap');

    items.each((_, el) => {
      const item = $(el);
      const titleLink = item.find('.genres-item-name, .item-title, h3 a, .story-name a').first();
      const href = titleLink.attr('href') || '';
      const title = this.cleanText(titleLink.text());
      const cover = item.find('img').first().attr('src') || null;
      const ratingStr = item.find('.genres-item-rate').text();
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

    // Detail selectors for MangaBox / Manganato
    const title =
      this.cleanText($('.story-info-right h1, .manga-info-top h1').text()) || manga.title;
    const cover =
      $('.story-info-left .info-image img, .manga-info-top .manga-info-pic img').attr('src') ||
      manga.coverUrl;

    const description = this.cleanText(
      $('.panel-story-info-description, #noidungm').text().replace(/Description\s*:\s*/i, '')
    );

    const authors: string[] = [];
    $('.table-value a[href*="/search/author/"], .manga-info-top a[href*="/search/author/"]').each((_, a) => {
      const auth = this.cleanText($(a).text());
      if (auth) authors.push(auth);
    });

    const tags: string[] = [];
    $('.table-value a[href*="/genre-"], .manga-info-top a[href*="/genre-"]').each((_, a) => {
      const tag = this.cleanText($(a).text());
      if (tag) tags.push(tag);
    });

    const statusText = $('.story-info-right, .manga-info-top').text().toLowerCase();
    let state: SourceManga['state'] = 'ongoing';
    if (statusText.includes('completed')) {
      state = 'completed';
    }

    return {
      ...manga,
      title,
      coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : manga.coverUrl,
      description: description || manga.description,
      authors: authors.length > 0 ? authors : manga.authors,
      tags: tags.length > 0 ? tags : manga.tags,
      state,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const fullUrl = manga.url.startsWith('http') ? manga.url : this.toAbsoluteUrl(manga.url);
    const $ = await this.fetchHtml(fullUrl);
    const chapters: SourceChapter[] = [];

    // MangaBox chapter rows
    $('.row-content-chapter li, .chapter-list .row').each((_, el) => {
      const row = $(el);
      const link = row.find('a.chapter-name, a').first();
      const href = link.attr('href') || '';
      const name = this.cleanText(link.text());
      const dateText = this.cleanText(row.find('.chapter-time').text());

      if (href && name) {
        chapters.push({
          id: `${this.metadata.id}:${href}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          url: href,
          name,
          number: this.parseChapterNumber(name),
          dateUpload: this.parseDate(dateText),
        });
      }
    });

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const fullUrl = chapter.url.startsWith('http') ? chapter.url : this.toAbsoluteUrl(chapter.url);
    const $ = await this.fetchHtml(fullUrl);
    const pages: SourcePage[] = [];

    // Container chapter reader
    $('.container-chapter-reader img').each((i, el) => {
      const img = $(el);
      const src = img.attr('src') || img.attr('data-src') || '';
      if (src && !src.includes('banner') && !src.includes('ads')) {
        pages.push({
          index: i,
          url: src.startsWith('http') ? src : this.toAbsoluteUrl(src),
          headers: {
            Referer: this.metadata.baseUrl,
            'User-Agent': DEFAULT_USER_AGENT,
          },
        });
      }
    });

    return pages;
  }
}
