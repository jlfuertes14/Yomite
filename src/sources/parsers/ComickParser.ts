/**
 * ComicK Parser
 * Ported from Kotatsu's site/all/ComickFunParser.kt
 * Uses official API endpoints on comick.dev and provides Cloudflare error detection.
 */
import { BaseParser } from './BaseParser';
import {
  MangaSourceMetadata,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
  SourceTag,
} from '../types';
import { sourceHttpClient, DEFAULT_USER_AGENT } from '../network/httpClient';
import { CloudFlareError, CloudFlareStatus } from '../network/cloudflare';

export class ComickParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;
  private readonly domain = 'comick.dev';
  private readonly slugToHid = new Map<string, string>();

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: `https://${this.domain}/`,
      Accept: 'application/json, text/plain, */*',
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'action', label: 'Action', group: 'Genre' },
      { id: 'adventure', label: 'Adventure', group: 'Genre' },
      { id: 'comedy', label: 'Comedy', group: 'Genre' },
      { id: 'drama', label: 'Drama', group: 'Genre' },
      { id: 'fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'horror', label: 'Horror', group: 'Genre' },
      { id: 'mystery', label: 'Mystery', group: 'Genre' },
      { id: 'psychological', label: 'Psychological', group: 'Genre' },
      { id: 'romance', label: 'Romance', group: 'Genre' },
      { id: 'sci-fi', label: 'Sci-Fi', group: 'Genre' },
      { id: 'slice-of-life', label: 'Slice of Life', group: 'Genre' },
      { id: 'supernatural', label: 'Supernatural', group: 'Genre' },
      { id: 'thriller', label: 'Thriller', group: 'Genre' },
      { id: 'historical', label: 'Historical', group: 'Genre' },
      { id: 'isekai', label: 'Isekai', group: 'Genre' },
      { id: 'shounen', label: 'Shounen', group: 'Demographic' },
      { id: 'shoujo', label: 'Shoujo', group: 'Demographic' },
      { id: 'seinen', label: 'Seinen', group: 'Demographic' },
      { id: 'josei', label: 'Josei', group: 'Demographic' },
      { id: 'harem', label: 'Harem', group: 'Theme' },
      { id: 'martial-arts', label: 'Martial Arts', group: 'Theme' },
      { id: 'school-life', label: 'School Life', group: 'Theme' },
      { id: 'sports', label: 'Sports', group: 'Theme' },
      { id: 'mecha', label: 'Mecha', group: 'Theme' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const query = filter.query ? `&q=${encodeURIComponent(filter.query)}` : '';
    const genres =
      filter.tags && filter.tags.length > 0
        ? `&genres=${encodeURIComponent(filter.tags[0].toLowerCase().trim())}`
        : '';
    const sort = filter.order === 'popular' ? 'view' : 'uploaded';

    const url = `https://api.${this.domain}/v1.0/search?type=comic&tachiyomi=true&limit=20&page=${page}&sort=${sort}${query}${genres}`;

    try {
      const data = await sourceHttpClient.fetchJson<any[]>(url, {
        sourceId: this.metadata.name,
        referer: `https://${this.domain}/`,
        headers: this.getRequestHeaders(),
      });

      if (!Array.isArray(data)) return [];

      return data.map((item) => {
        const slug = item.slug || item.hid;
        if (item.slug && item.hid) {
          this.slugToHid.set(item.slug, item.hid);
        }
        return {
          id: `${this.metadata.id}:${slug}`,
          sourceId: this.metadata.id,
          title: this.cleanText(item.title || 'Untitled'),
          url: `/comic/${slug}`,
          publicUrl: `https://${this.domain}/comic/${slug}`,
          coverUrl:
            item.cover_url ||
            (item.md_covers?.[0]?.b2key
              ? `https://meo.comick.pictures/${item.md_covers[0].b2key}`
              : null),
          rating: item.rating ? parseFloat(item.rating) / 10 : undefined,
          state: item.status === 1 ? 'ongoing' : item.status === 2 ? 'completed' : undefined,
        };
      });
    } catch (err: any) {
      const status = err.response?.status;
      if (err.isCloudFlare || status === 403 || status === 503) {
        throw new CloudFlareError(
          `[ComicK] Cloudflare verification required for ${this.domain}.`,
          this.metadata.id,
          url,
          this.domain,
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
      throw err;
    }
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const rawId = manga.url.replace(/^\/comic\//, '').replace(/^\//, '');
    const url = `https://api.${this.domain}/comic/${rawId}?tachiyomi=true`;

    try {
      const data = await sourceHttpClient.fetchJson<any>(url, {
        sourceId: this.metadata.name,
        referer: `https://${this.domain}/`,
        headers: this.getRequestHeaders(),
      });

      const comic = data.comic || {};

      if (comic.hid) {
        this.slugToHid.set(rawId, comic.hid);
        if (comic.slug) {
          this.slugToHid.set(comic.slug, comic.hid);
        }
      }

      const coverUrl =
        comic.cover_url ||
        (comic.md_covers?.[0]?.b2key
          ? `https://meo.comick.pictures/${comic.md_covers[0].b2key}`
          : manga.coverUrl);

      const authors: string[] = [];
      if (Array.isArray(comic.authors)) {
        for (const a of comic.authors) if (a?.name) authors.push(a.name);
      } else if (Array.isArray(data.authors)) {
        for (const a of data.authors) if (a?.name) authors.push(a.name);
      }
      if (authors.length === 0 && manga.authors?.length) {
        authors.push(...manga.authors);
      }

      const artists: string[] = [];
      if (Array.isArray(comic.artists)) {
        for (const a of comic.artists) if (a?.name) artists.push(a.name);
      } else if (Array.isArray(data.artists)) {
        for (const a of data.artists) if (a?.name) artists.push(a.name);
      }

      const tags: string[] = [];
      if (Array.isArray(comic.md_comic_md_genres)) {
        for (const g of comic.md_comic_md_genres) {
          const name = g.md_genres?.name;
          if (name && !tags.includes(name)) tags.push(name);
        }
      }

      return {
        ...manga,
        title: this.cleanText(comic.title || manga.title),
        coverUrl,
        authors: authors.length ? authors : manga.authors,
        artists: artists.length ? artists : manga.artists,
        tags: tags.length ? tags : manga.tags,
        description: comic.desc || comic.parsed || manga.description,
        chaptersCount:
          typeof comic.last_chapter === 'number'
            ? comic.last_chapter
            : manga.chaptersCount,
        state: comic.status === 1 ? 'ongoing' : comic.status === 2 ? 'completed' : manga.state,
      };
    } catch (err: any) {
      const status = err.response?.status;
      if (err.isCloudFlare || status === 403 || status === 503) {
        throw new CloudFlareError(
          `[ComicK] Cloudflare verification required for ${this.domain}.`,
          this.metadata.id,
          url,
          this.domain,
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
      throw err;
    }
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const rawId = manga.url.replace(/^\/comic\//, '').replace(/^\//, '');
    let hid = this.slugToHid.get(rawId);

    // ComicK /comic/{id}/chapters strictly expects the comic's hid (hash ID).
    // If hid is not in memory cache, resolve it by calling getDetails first.
    if (!hid) {
      try {
        await this.getDetails(manga);
        hid = this.slugToHid.get(rawId);
      } catch (detailErr) {
        // If getDetails failed due to CloudFlare, propagate the CloudFlareError
        if ((detailErr as any)?.isCloudFlare) throw detailErr;
      }
    }

    const comicId = hid || rawId;
    const url = `https://api.${this.domain}/comic/${comicId}/chapters?limit=9999`;

    try {
      const data = await sourceHttpClient.fetchJson<any>(url, {
        sourceId: this.metadata.name,
        referer: `https://${this.domain}/`,
        headers: this.getRequestHeaders(),
      });

      const chapters = data.chapters || [];
      return chapters.map((c: any) => ({
        id: `${this.metadata.id}:${c.hid}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: c.title || `Chapter ${c.chap || ''}`,
        number: parseFloat(c.chap) || 0,
        url: `/chapter/${c.hid}`,
        dateUpload: c.created_at ? new Date(c.created_at).getTime() : undefined,
      }));
    } catch (err: any) {
      const status = err.response?.status;
      if (err.isCloudFlare || status === 403 || status === 503) {
        throw new CloudFlareError(
          `[ComicK] Cloudflare verification required for ${this.domain}.`,
          this.metadata.id,
          url,
          this.domain,
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
      throw err;
    }
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const hid = chapter.url.replace(/^\/chapter\//, '').replace(/^\//, '');
    const url = `https://api.${this.domain}/chapter/${hid}?tachiyomi=true`;

    try {
      const data = await sourceHttpClient.fetchJson<any>(url, {
        sourceId: this.metadata.name,
        referer: `https://${this.domain}/`,
        headers: this.getRequestHeaders(),
      });

      const images = data.chapter?.images || [];
      return images.map((img: any, idx: number) => ({
        index: idx,
        url: img.url,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Referer: `https://${this.domain}/`,
        },
      }));
    } catch (err: any) {
      const status = err.response?.status;
      if (err.isCloudFlare || status === 403 || status === 503) {
        throw new CloudFlareError(
          `[ComicK] Cloudflare verification required for ${this.domain}.`,
          this.metadata.id,
          url,
          this.domain,
          CloudFlareStatus.CAPTCHA_CHALLENGE
        );
      }
      throw err;
    }
  }
}
