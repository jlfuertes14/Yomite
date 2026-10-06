/**
 * ComicK Parser
 * Ported from Kotatsu's site/all/ComickFunParser.kt
 * Note: Kotatsu marks Comick as @Broken("Original site closed").
 * Uses official API endpoints when available and provides clear Cloudflare diagnostics.
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

export class ComickParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;
  private readonly domain = 'comick.io';

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: 'https://comick.io/',
      Accept: 'application/json, text/plain, */*',
    };
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const query = filter.query ? `&q=${encodeURIComponent(filter.query)}` : '';
    const sort = filter.order === 'popular' ? 'view' : 'uploaded';

    const url = `https://api.${this.domain}/v1.0/search?type=comic&tachiyomi=true&limit=20&page=${page}&sort=${sort}${query}`;

    try {
      const data = await sourceHttpClient.fetchJson<any[]>(url, {
        sourceId: this.metadata.name,
        referer: 'https://comick.io/',
        headers: this.getRequestHeaders(),
      });

      if (!Array.isArray(data)) return [];

      return data.map((item) => {
        const slug = item.slug || item.hid;
        return {
          id: `${this.metadata.id}:${slug}`,
          sourceId: this.metadata.id,
          title: this.cleanText(item.title || 'Untitled'),
          url: `/comic/${slug}`,
          publicUrl: `https://${this.domain}/comic/${slug}`,
          coverUrl: item.cover_url || (item.md_covers?.[0]?.b2key ? `https://meo.comick.pictures/${item.md_covers[0].b2key}` : null),
          rating: item.rating ? parseFloat(item.rating) / 10 : undefined,
          state: item.status === 1 ? 'ongoing' : item.status === 2 ? 'completed' : undefined,
        };
      });
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403 || status === 404 || status === 503) {
        throw new Error(
          `[ComicK] ComicK is protected by Cloudflare Turnstile or undergoing server migration. In Kotatsu catalog, ComicK is marked as "@Broken: Original site closed".`
        );
      }
      throw err;
    }
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const slug = manga.url.replace(/^\/comic\//, '').replace(/^\//, '');
    const url = `https://api.${this.domain}/comic/${slug}?tachiyomi=true`;

    const data = await sourceHttpClient.fetchJson<any>(url, {
      sourceId: this.metadata.name,
      referer: 'https://comick.io/',
      headers: this.getRequestHeaders(),
    });

    const comic = data.comic || {};
    return {
      ...manga,
      title: this.cleanText(comic.title || manga.title),
      description: comic.desc || comic.parsed || manga.description,
      state: comic.status === 1 ? 'ongoing' : comic.status === 2 ? 'completed' : manga.state,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const slug = manga.url.replace(/^\/comic\//, '').replace(/^\//, '');
    const url = `https://api.${this.domain}/comic/${slug}/chapters?limit=9999`;

    const data = await sourceHttpClient.fetchJson<any>(url, {
      sourceId: this.metadata.name,
      referer: 'https://comick.io/',
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
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const hid = chapter.url.replace(/^\/chapter\//, '').replace(/^\//, '');
    const url = `https://api.${this.domain}/chapter/${hid}?tachiyomi=true`;

    const data = await sourceHttpClient.fetchJson<any>(url, {
      sourceId: this.metadata.name,
      referer: 'https://comick.io/',
      headers: this.getRequestHeaders(),
    });

    const images = data.chapter?.images || [];
    return images.map((img: any, idx: number) => ({
      index: idx,
      url: img.url,
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: 'https://comick.io/',
      },
    }));
  }
}
