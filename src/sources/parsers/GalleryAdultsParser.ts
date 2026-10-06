/**
 * Adult Gallery Engine Parser
 * Ported from Kotatsu's site/galleryadults/GalleryAdultsParser.kt
 * Powers HentaiFox, 3Hentai, AsmHentai, HentaiEra, NHentai mirror domains, etc.
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

export class GalleryAdultsParser extends BaseParser {
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
      url = `${this.metadata.baseUrl}/search/?q=${q}${page > 1 ? `&page=${page}` : ''}`;
    } else {
      url = `${this.metadata.baseUrl}/?page=${page}`;
    }

    let $;
    try {
      $ = await this.fetchHtml(url);
    } catch (err: any) {
      // Fallback for sites using /page/{page}/
      if (err.response?.status === 404 && page > 1) {
        url = `${this.metadata.baseUrl}/page/${page}/`;
        $ = await this.fetchHtml(url);
      } else {
        throw err;
      }
    }

    const mangaList: SourceManga[] = [];

    // Kotatsu GalleryAdults selectors
    const items = $(
      '.gallery, .thumb, .lc_galleries .thumb, .related_galleries .thumb, .doujin, div.index-container .gallery'
    );

    items.each((_, el) => {
      const item = $(el);
      const link = item.find('a, .inner_thumb a').first();
      const href = link.attr('href') || '';

      const titleEl = item.find('.caption, .title, h2, h3, .inner_thumb a').first();
      let title = this.cleanText(titleEl.text() || link.attr('title') || '');

      // Remove brackets e.g. [Artist] Title (Event)
      title = title.replace(/\[[^\]]+\]|\([^)]+\)/g, '').trim() || title;

      const img = item.find('img').first();
      const cover =
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        img.attr('data-original') ||
        img.attr('src') ||
        null;

      if (href && title) {
        mangaList.push({
          id: `${this.metadata.id}:${href}`,
          sourceId: this.metadata.id,
          title,
          url: href,
          publicUrl: href.startsWith('http') ? href : this.toAbsoluteUrl(href),
          coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : null,
          state: 'completed',
        });
      }
    });

    return mangaList;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const fullUrl = manga.url.startsWith('http') ? manga.url : this.toAbsoluteUrl(manga.url);
    const $ = await this.fetchHtml(fullUrl);

    const titleEl = $('h1.title, .title, #info h1, h1').first();
    const rawTitle = titleEl.text().trim();
    const title = rawTitle.replace(/\[[^\]]+\]|\([^)]+\)/g, '').trim() || manga.title;

    const coverEl = $('#cover img, .cover img, .left_cover img, .g_thumb img, #main-cover img').first();
    const cover =
      coverEl.attr('data-src') ||
      coverEl.attr('data-lazy-src') ||
      coverEl.attr('data-original') ||
      coverEl.attr('src') ||
      manga.coverUrl;

    const tags: string[] = [];
    $('div.tags a, .tag-container a, ul.tags a, .tag_list a').each((_, el) => {
      const t = this.cleanText($(el).text());
      if (t && !tags.includes(t)) tags.push(t);
    });

    const authors: string[] = [];
    $('ul.artists a, .tag-container:contains(Artists) a, .tag-container:contains(Artist) a').each(
      (_, el) => {
        const a = this.cleanText($(el).text());
        if (a && !authors.includes(a)) authors.push(a);
      }
    );

    return {
      ...manga,
      title: title || manga.title,
      coverUrl: cover ? (cover.startsWith('http') ? cover : this.toAbsoluteUrl(cover)) : null,
      authors: authors.length ? authors : undefined,
      tags: tags.slice(0, 15),
      state: 'completed',
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    return [
      {
        id: `${this.metadata.id}:${manga.url}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: manga.title,
        number: 1,
        url: manga.url,
        dateUpload: Date.now(),
      },
    ];
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const fullUrl = chapter.url.startsWith('http') ? chapter.url : this.toAbsoluteUrl(chapter.url);
    const $ = await this.fetchHtml(fullUrl);
    const pages: SourcePage[] = [];

    // Parse thumbnails from gallery view
    const thumbImgs = $(
      '#thumbnail-container .thumb-container a img, .thumbs a img, .g_thumb a img, .gallery_thumbs a img'
    );

    if (thumbImgs.length > 0) {
      thumbImgs.each((index, el) => {
        const img = $(el);
        const thumbUrl =
          img.attr('data-src') ||
          img.attr('data-lazy-src') ||
          img.attr('data-original') ||
          img.attr('src') ||
          '';

        if (thumbUrl) {
          // Typically in galleries: /thumb.jpg or 1t.jpg -> 1.jpg
          const fullImgUrl = thumbUrl
            .replace(/t\.(jpg|png|webp|gif)/, '.$1')
            .replace(/\/thumb\//, '/');

          pages.push({
            index,
            url: fullImgUrl.startsWith('http') ? fullImgUrl : this.toAbsoluteUrl(fullImgUrl),
            headers: this.getRequestHeaders(),
          });
        }
      });
    }

    return pages;
  }
}
