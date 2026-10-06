/**
 * NHentai Parser (Official v2 API)
 * High-performance, Cloudflare-bypassing JSON API client for NHentai.net
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

interface NHentaiGalleryItem {
  id: number;
  media_id: string;
  english_title?: string;
  japanese_title?: string;
  thumbnail?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  num_pages?: number;
  num_favorites?: number;
  tag_ids?: number[];
}

interface NHentaiGalleryDetail {
  id: number;
  media_id: string;
  title?: {
    english?: string;
    japanese?: string;
    pretty?: string;
  } | string;
  cover?: string;
  thumbnail?: string;
  scanlator?: string;
  upload_date?: number;
  tags?: Array<{
    id: number;
    type: string;
    name: string;
    url?: string;
    count?: number;
  }>;
  num_pages?: number;
  num_favorites?: number;
  pages?: Array<{
    number: number;
    path: string;
    width?: number;
    height?: number;
    thumbnail?: string;
  }>;
}

export class NHentaiParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: 'https://nhentai.net/',
      Accept: 'application/json, text/plain, */*',
    };
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let url: string;

    if (filter.query && filter.query.trim().length > 0) {
      const q = encodeURIComponent(filter.query.trim());
      url = `https://nhentai.net/api/v2/search?query=${q}&page=${page}&sort=popular`;
    } else if (filter.order === 'popular' && page === 1) {
      url = 'https://nhentai.net/api/v2/galleries/popular';
    } else if (filter.order === 'popular') {
      url = `https://nhentai.net/api/v2/search?query=pages:>0&sort=popular&page=${page}`;
    } else {
      url = `https://nhentai.net/api/v2/galleries?page=${page}`;
    }

    const data = await sourceHttpClient.fetchJson<any>(url, {
      sourceId: this.metadata.name,
      referer: 'https://nhentai.net/',
    });

    // Response is either { result: [...] } or array directly
    const items: NHentaiGalleryItem[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.result)
      ? data.result
      : [];

    return items.map((item) => {
      const title =
        item.english_title ||
        item.japanese_title ||
        `Gallery #${item.id}`;

      let coverUrl: string | null = null;
      if (item.thumbnail) {
        coverUrl = item.thumbnail.startsWith('http')
          ? item.thumbnail
          : `https://t.nhentai.net/${item.thumbnail.replace(/^\/+/, '')}`;
      } else if (item.media_id) {
        coverUrl = `https://t.nhentai.net/galleries/${item.media_id}/thumb.jpg`;
      }

      // Convert favorites (0 - 50,000+) to a 1 - 10 rating scale
      let rating: number | undefined = undefined;
      if (typeof item.num_favorites === 'number' && item.num_favorites > 0) {
        // e.g. 500 favorites -> ~7.2, 5000 favorites -> ~8.8, 20000 -> 9.5
        const normalized = Math.min(10, (Math.log10(item.num_favorites + 1) / 4.5) * 10);
        rating = Math.round(normalized * 10) / 10;
      }

      return {
        id: `${this.metadata.id}:${item.id}`,
        sourceId: this.metadata.id,
        title: this.cleanText(title),
        url: `/g/${item.id}/`,
        publicUrl: `https://nhentai.net/g/${item.id}/`,
        coverUrl,
        rating,
        state: 'completed',
      };
    });
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const galleryId = this.extractGalleryId(manga.url || manga.id);
    if (!galleryId) return manga;

    const url = `https://nhentai.net/api/v2/galleries/${galleryId}`;
    const data = await sourceHttpClient.fetchJson<NHentaiGalleryDetail>(url, {
      sourceId: this.metadata.name,
      referer: 'https://nhentai.net/',
    });

    const titleObj = data.title;
    const title =
      typeof titleObj === 'string'
        ? titleObj
        : titleObj?.pretty || titleObj?.english || titleObj?.japanese || manga.title;

    let coverUrl = manga.coverUrl;
    if (data.cover) {
      const cover = typeof data.cover === 'string' ? data.cover : data.media_id ? `galleries/${data.media_id}/cover.jpg` : '';
      if (cover) {
        coverUrl = cover.startsWith('http')
          ? cover
          : `https://t.nhentai.net/${cover.replace(/^\/+/, '')}`;
      }
    }

    const tags: string[] = [];
    const authors: string[] = [];

    if (Array.isArray(data.tags)) {
      for (const t of data.tags) {
        if (t.type === 'tag' || t.type === 'parody' || t.type === 'character') {
          tags.push(t.name);
        } else if (t.type === 'artist' || t.type === 'group') {
          authors.push(t.name);
        }
      }
    }

    return {
      ...manga,
      title: this.cleanText(title),
      coverUrl,
      authors: authors.length ? authors : undefined,
      tags: tags.slice(0, 15),
      description: `Pages: ${data.num_pages || data.pages?.length || 0} · Favorites: ${
        data.num_favorites || 0
      }${authors.length ? ` · Artists: ${authors.join(', ')}` : ''}`,
      state: 'completed',
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const galleryId = this.extractGalleryId(manga.url || manga.id);
    return [
      {
        id: `${this.metadata.id}:${galleryId || manga.id}`,
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
    const galleryId = this.extractGalleryId(chapter.url || chapter.id);
    if (!galleryId) return [];

    const url = `https://nhentai.net/api/v2/galleries/${galleryId}`;
    const data = await sourceHttpClient.fetchJson<NHentaiGalleryDetail>(url, {
      sourceId: this.metadata.name,
      referer: 'https://nhentai.net/',
    });

    if (!Array.isArray(data.pages)) {
      return [];
    }

    return data.pages.map((p, idx) => {
      const pageNum = p.number || idx + 1;
      const imageUrl = p.path.startsWith('http')
        ? p.path
        : `https://i.nhentai.net/${p.path.replace(/^\/+/, '')}`;

      return {
        index: idx,
        url: imageUrl,
        headers: this.getRequestHeaders(),
      };
    });
  }

  private extractGalleryId(str: string): string {
    const match = str.match(/(?:g\/|:)(\d+)/);
    return match ? match[1] : str.replace(/[^\d]/g, '');
  }
}
