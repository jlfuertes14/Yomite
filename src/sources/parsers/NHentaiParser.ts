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
  SourceSortOption,
  SourceTag,
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

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Popular All-Time' },
      { id: 'popular-today', label: 'Popular Today' },
      { id: 'popular-week', label: 'Popular This Week' },
      { id: 'recent', label: 'Recent' },
    ];
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      // Categories
      { id: 'category:"doujinshi"', label: 'Doujinshi', group: 'Category' },
      { id: 'category:"manga"', label: 'Manga', group: 'Category' },
      { id: 'category:"artistcg"', label: 'Artist CG', group: 'Category' },
      { id: 'category:"gamecg"', label: 'Game CG', group: 'Category' },
      { id: 'category:"western"', label: 'Western', group: 'Category' },
      // Popular Tags
      { id: 'tag:"sole female"', label: 'Sole Female', group: 'Tag' },
      { id: 'tag:"sole male"', label: 'Sole Male', group: 'Tag' },
      { id: 'tag:"big breasts"', label: 'Big Breasts', group: 'Tag' },
      { id: 'tag:"schoolgirl uniform"', label: 'Schoolgirl Uniform', group: 'Tag' },
      { id: 'tag:"stockings"', label: 'Stockings', group: 'Tag' },
      { id: 'tag:"anal"', label: 'Anal', group: 'Tag' },
      { id: 'tag:"glasses"', label: 'Glasses', group: 'Tag' },
      { id: 'tag:"defloration"', label: 'Defloration', group: 'Tag' },
      { id: 'tag:"milf"', label: 'MILF', group: 'Tag' },
      { id: 'tag:"group"', label: 'Group', group: 'Tag' },
      { id: 'tag:"nakadashi"', label: 'Nakadashi', group: 'Tag' },
      { id: 'tag:"blowjob"', label: 'Blowjob', group: 'Tag' },
      { id: 'tag:"yuri"', label: 'Yuri', group: 'Tag' },
      { id: 'tag:"yaoi"', label: 'Yaoi', group: 'Tag' },
      { id: 'tag:"femdom"', label: 'Femdom', group: 'Tag' },
      { id: 'tag:"maid"', label: 'Maid', group: 'Tag' },
      { id: 'tag:"swimsuit"', label: 'Swimsuit', group: 'Tag' },
      { id: 'tag:"incest"', label: 'Incest', group: 'Tag' },
      { id: 'tag:"mind break"', label: 'Mind Break', group: 'Tag' },
      { id: 'tag:"futanari"', label: 'Futanari', group: 'Tag' },
      { id: 'tag:"dark skin"', label: 'Dark Skin', group: 'Tag' },
      { id: 'tag:"netorare"', label: 'Netorare', group: 'Tag' },
      { id: 'tag:"cheating"', label: 'Cheating', group: 'Tag' },
      { id: 'tag:"monster girl"', label: 'Monster Girl', group: 'Tag' },
      { id: 'tag:"paizuri"', label: 'Paizuri', group: 'Tag' },
      { id: 'tag:"bondage"', label: 'Bondage', group: 'Tag' },
      { id: 'tag:"full color"', label: 'Full Color', group: 'Tag' },
      // Languages
      { id: 'language:english', label: 'English', group: 'Language' },
      { id: 'language:japanese', label: 'Japanese', group: 'Language' },
      { id: 'language:chinese', label: 'Chinese', group: 'Language' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let url: string;

    const terms: string[] = [];
    if (filter.query && filter.query.trim().length > 0) {
      terms.push(filter.query.trim());
    }
    if (filter.tags && filter.tags.length > 0) {
      for (const t of filter.tags) {
        if (!t) continue;
        if (t.includes(':') || t.startsWith('tag:')) {
          terms.push(t);
        } else {
          terms.push(`tag:"${t}"`);
        }
      }
    }

    const sortParam =
      filter.order === 'popular-today'
        ? '&sort=popular-today'
        : filter.order === 'popular-week'
        ? '&sort=popular-week'
        : filter.order === 'popular'
        ? '&sort=popular'
        : '';

    if (terms.length > 0) {
      const q = encodeURIComponent(terms.join(' '));
      url = `https://nhentai.net/api/v2/search?query=${q}&page=${page}${sortParam || '&sort=popular'}`;
    } else if (filter.order === 'popular' && page === 1) {
      url = 'https://nhentai.net/api/v2/galleries/popular';
    } else if (
      filter.order === 'popular' ||
      filter.order === 'popular-today' ||
      filter.order === 'popular-week'
    ) {
      url = `https://nhentai.net/api/v2/search?query=pages:>0${sortParam}&page=${page}`;
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

      // Detect language (English: 12227, Chinese: 29963, Japanese: 6346 or title/fallback)
      let locale: string = 'ja';
      if (item.tag_ids?.includes(12227)) {
        locale = 'en';
      } else if (item.tag_ids?.includes(29963)) {
        locale = 'zh';
      } else if (item.tag_ids?.includes(6346)) {
        locale = 'ja';
      } else if (/(?:\[|\()(?:english|eng)(?:\]|\))/i.test(title)) {
        locale = 'en';
      } else if (/(?:\[|\()(?:chinese|中国翻訳|中國翻譯|漢化|汉化|中国語|個人漢化|臉腫漢化組|绅士仓库汉化)(?:\]|\))/i.test(title)) {
        locale = 'zh';
      } else if (/(?:\[|\()(?:japanese)(?:\]|\))/i.test(title)) {
        locale = 'ja';
      }

      return {
        id: `${this.metadata.id}:${item.id}`,
        sourceId: this.metadata.id,
        title: this.cleanText(title),
        url: `/g/${item.id}/`,
        publicUrl: `https://nhentai.net/g/${item.id}/`,
        coverUrl,
        rating,
        locale,
        state: 'completed',
      };
    });
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const galleryId = this.extractGalleryId(manga.url || manga.id);
    if (!galleryId) return manga;

    // 1. Try JSON API (v1 /api/gallery/{id} or v2 /api/v2/galleries/{id})
    try {
      let data: any = null;
      try {
        data = await sourceHttpClient.fetchJson<any>(`https://nhentai.net/api/gallery/${galleryId}`, {
          sourceId: this.metadata.name,
          referer: 'https://nhentai.net/',
        });
      } catch {
        data = await sourceHttpClient.fetchJson<any>(`https://nhentai.net/api/v2/galleries/${galleryId}`, {
          sourceId: this.metadata.name,
          referer: 'https://nhentai.net/',
        });
      }

      if (data && (data.id || data.media_id)) {
        const titleObj = data.title;
        const title =
          typeof titleObj === 'string'
            ? titleObj
            : titleObj?.pretty || titleObj?.english || titleObj?.japanese || manga.title;

        let coverUrl = manga.coverUrl;
        if (data.media_id) {
          const ext = data.images?.cover?.t === 'p' ? 'png' : data.images?.cover?.t === 'w' ? 'webp' : 'jpg';
          coverUrl = `https://t.nhentai.net/galleries/${data.media_id}/cover.${ext}`;
        } else if (data.cover) {
          const cover = typeof data.cover === 'string' ? data.cover : '';
          if (cover) {
            coverUrl = cover.startsWith('http')
              ? cover
              : `https://t.nhentai.net/${cover.replace(/^\/+/, '')}`;
          }
        }

        const tags: string[] = [];
        const authors: string[] = [];
        const parodies: string[] = [];
        let locale: string = manga.locale || 'ja';

        if (Array.isArray(data.tags)) {
          for (const t of data.tags) {
            if (t.type === 'tag' || t.type === 'character') {
              tags.push(t.name);
            } else if (t.type === 'artist' || t.type === 'group') {
              authors.push(t.name);
            } else if (t.type === 'parody') {
              parodies.push(t.name);
            } else if (t.type === 'language') {
              if (t.name === 'english') locale = 'en';
              else if (t.name === 'chinese') locale = 'zh';
              else if (t.name === 'japanese') locale = 'ja';
            }
          }
        }

        if (!locale) {
          if (/(?:\[|\()(?:english|eng)(?:\]|\))/i.test(title)) locale = 'en';
          else if (/(?:\[|\()(?:chinese|中国翻訳|中國翻譯|漢化|汉化|中国語|個人漢化)(?:\]|\))/i.test(title)) locale = 'zh';
          else locale = 'ja';
        }

        const pagesCount = data.num_pages || data.pages?.length || 0;
        const descParts: string[] = [];
        if (pagesCount) descParts.push(`Pages: ${pagesCount}`);
        if (data.num_favorites) descParts.push(`Favorites: ${data.num_favorites}`);
        if (authors.length) descParts.push(`Artists: ${authors.join(', ')}`);
        if (parodies.length) descParts.push(`Parodies: ${parodies.join(', ')}`);

        return {
          ...manga,
          title: this.cleanText(title),
          coverUrl,
          authors: authors.length ? authors : undefined,
          tags: tags.slice(0, 15),
          description: descParts.length ? descParts.join(' · ') : undefined,
          locale,
          state: 'completed',
        };
      }
    } catch {
      // Fall through to HTML scraping fallback
    }

    // 2. HTML scraping fallback for nhentai gallery details
    try {
      const $ = await this.fetchHtml(`https://nhentai.net/g/${galleryId}/`);
      const title = this.cleanText(
        $('#info h1.title, #info h2.title, .title .pretty, .title').first().text() || manga.title
      );

      const coverImg = $('#cover img');
      const cover = coverImg.attr('data-src') || coverImg.attr('src') || null;

      const authors: string[] = [];
      const tags: string[] = [];
      const parodies: string[] = [];
      let locale: string = manga.locale || 'ja';
      let pagesCount = 0;

      $('#tags .tag-container').each((_, container) => {
        const headerText = this.cleanText($(container).text()).toLowerCase();
        if (headerText.includes('artist') || headerText.includes('group')) {
          $(container).find('.name').each((__, nameEl) => {
            const name = this.cleanText($(nameEl).text());
            if (name && !authors.includes(name)) authors.push(name);
          });
        } else if (headerText.includes('parod')) {
          $(container).find('.name').each((__, nameEl) => {
            const name = this.cleanText($(nameEl).text());
            if (name && !parodies.includes(name)) parodies.push(name);
          });
        } else if (headerText.includes('tag')) {
          $(container).find('.name').each((__, nameEl) => {
            const name = this.cleanText($(nameEl).text());
            if (name && !tags.includes(name)) tags.push(name);
          });
        } else if (headerText.includes('language')) {
          const langText = $(container).text().toLowerCase();
          if (langText.includes('english')) locale = 'en';
          else if (langText.includes('chinese')) locale = 'zh';
          else if (langText.includes('japanese')) locale = 'ja';
        } else if (headerText.includes('page')) {
          const num = parseInt($(container).find('.name').text() || '0', 10);
          if (num > 0) pagesCount = num;
        }
      });

      if (!locale) {
        if (/(?:\[|\()(?:english|eng)(?:\]|\))/i.test(title)) locale = 'en';
        else if (/(?:\[|\()(?:chinese|中国翻訳|中國翻譯|漢化|汉化|中国語|個人漢化)(?:\]|\))/i.test(title)) locale = 'zh';
        else locale = 'ja';
      }

      const descParts: string[] = [];
      if (pagesCount) descParts.push(`Pages: ${pagesCount}`);
      if (authors.length) descParts.push(`Artists: ${authors.join(', ')}`);
      if (parodies.length) descParts.push(`Parodies: ${parodies.join(', ')}`);
      if (tags.length) descParts.push(`Tags: ${tags.slice(0, 5).join(', ')}`);

      return {
        ...manga,
        title,
        coverUrl: cover ? this.toAbsoluteUrl(cover) : manga.coverUrl,
        authors: authors.length ? authors : manga.authors,
        tags: tags.length ? tags.slice(0, 15) : manga.tags,
        description: descParts.length ? descParts.join(' · ') : undefined,
        locale,
        state: 'completed',
      };
    } catch {
      return manga;
    }
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
        locale: manga.locale || 'ja',
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
