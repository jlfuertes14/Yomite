/**
 * HeanCMS Engine Parser
 * Ported from Kotatsu's site/heancms/HeanCms.kt
 * Powers OmegaScans, ReaperScans, TempleScan, PerfScan, etc.
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

export class HeanCmsParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  private get apiDomain(): string {
    return `api.${this.metadata.domain}`;
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: `https://${this.metadata.domain}/`,
      Accept: 'application/json, text/plain, */*',
    };
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const query = filter.query ? encodeURIComponent(filter.query.trim()) : '';

    let orderBy = 'latest&order=desc';
    if (filter.order === 'popular') orderBy = 'total_views&order=desc';
    else if (filter.order === 'newest') orderBy = 'created_at&order=desc';
    else if (filter.order === 'alphabetical') orderBy = 'title&order=asc';

    const url = `https://${this.apiDomain}/query?query_string=${query}&series_type=Comic&perPage=20&orderBy=${orderBy}&page=${page}`;

    const res = await sourceHttpClient.fetchJson<any>(url, {
      sourceId: this.metadata.name,
      referer: `https://${this.metadata.domain}/`,
    });

    const items = Array.isArray(res?.data) ? res.data : [];

    return items.map((item: any) => {
      const slug = item.series_slug || item.slug || String(item.id);
      let coverUrl: string | null = null;
      if (item.thumbnail) {
        coverUrl = item.thumbnail.startsWith('http')
          ? item.thumbnail
          : `https://${this.apiDomain}/${item.thumbnail.replace(/^\/+/, '')}`;
      }

      let rating: number | undefined = undefined;
      if (typeof item.rating === 'number' && item.rating > 0) {
        // Rating out of 5 -> scale to 10
        rating = Math.round(item.rating * 2 * 10) / 10;
      }

      return {
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        title: this.cleanText(item.title || slug),
        url: `/series/${slug}`,
        publicUrl: `https://${this.metadata.domain}/series/${slug}`,
        coverUrl,
        rating,
        description: item.description ? this.cleanText(item.description) : undefined,
        state: item.status === 'Completed' ? 'completed' : 'ongoing',
      };
    });
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const rawSlug = this.extractSlug(manga.url);
    const slug =
      rawSlug && rawSlug !== this.metadata.id
        ? rawSlug
        : manga.id.replace(new RegExp(`^${this.metadata.id}:`), '');

    try {
      const data = await this.fetchSeries(slug);

      let coverUrl = manga.coverUrl;
      if (data?.thumbnail) {
        coverUrl = data.thumbnail.startsWith('http')
          ? data.thumbnail
          : `https://${this.apiDomain}/${data.thumbnail.replace(/^\/+/, '')}`;
      }

      const tags: string[] = [];
      if (Array.isArray(data?.tags)) {
        for (const t of data.tags) {
          const name = typeof t === 'string' ? t : t?.name;
          if (name) tags.push(name);
        }
      }

      return {
        ...manga,
        title: data?.title || manga.title,
        coverUrl,
        description: data?.description ? this.cleanText(data.description) : manga.description,
        authors: data?.author ? [data.author] : undefined,
        tags: tags.slice(0, 15),
        state: data?.status === 'Completed' ? 'completed' : 'ongoing',
      };
    } catch {
      return manga;
    }
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const rawSlug = this.extractSlug(manga.url);
    const slug =
      rawSlug && rawSlug !== this.metadata.id
        ? rawSlug
        : manga.id.replace(new RegExp(`^${this.metadata.id}:`), '');

    let seriesData: any = null;
    try {
      seriesData = await this.fetchSeries(slug);
    } catch {
      seriesData = null;
    }

    let seriesId = seriesData?.id || null;
    if (!seriesId) {
      const idMatch = manga.id.match(/:(\d+)$/);
      if (idMatch) seriesId = parseInt(idMatch[1], 10);
    }

    if (!seriesId) return [];

    const url = `https://${this.apiDomain}/chapter/query?page=1&perPage=9999&series_id=${encodeURIComponent(String(seriesId))}`;
    const res = await sourceHttpClient.fetchJson<any>(url, {
      sourceId: this.metadata.name,
      referer: `https://${this.metadata.domain}/`,
    });

    const data = Array.isArray(res?.data) ? res.data : [];
    const seriesSlug = seriesData?.series_slug || (slug && !/^\d+$/.test(slug) ? slug : String(seriesId));

    return data.map((ch: any, idx: number) => {
      const chSlug = ch.chapter_slug || String(ch.id || idx + 1);
      const chName = ch.chapter_name || ch.chapter_title || `Chapter ${chSlug}`;
      const num = this.parseChapterNumber(chName) || this.parseChapterNumber(ch.index) || idx + 1;
      const chUrl = `/series/${seriesSlug}/${chSlug}`;

      return {
        id: `${this.metadata.id}:${seriesSlug}:${chSlug}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: chName,
        number: num,
        url: chUrl,
        dateUpload: ch.created_at ? Date.parse(ch.created_at) : undefined,
      };
    });
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    let seriesSlug = '';
    let chapterSlug = '';

    // Case 1: chapter.url is /series/{series_slug}/{chapter_slug}
    const urlMatch = chapter.url.match(/\/series\/([^/]+)\/([^/?#]+)/i);
    if (urlMatch) {
      seriesSlug = urlMatch[1];
      chapterSlug = urlMatch[2];
    } else {
      // Case 2: Parse from chapter.id
      const idParts = chapter.id.split(':');
      if (idParts.length >= 3) {
        seriesSlug = idParts[idParts.length - 2];
        chapterSlug = idParts[idParts.length - 1];
      } else if (chapter.url.includes(':')) {
        const rawParts = chapter.url.split(':');
        seriesSlug = rawParts[0];
        chapterSlug = rawParts[1];
      }
    }

    // Handle legacy numeric IDs (e.g. seriesId 54, chapterId 1826)
    if (/^\d+$/.test(seriesSlug) && /^\d+$/.test(chapterSlug)) {
      try {
        const queryRes = await sourceHttpClient.fetchJson<any>(
          `https://${this.apiDomain}/chapter/query?page=1&perPage=9999&series_id=${seriesSlug}`,
          {
            sourceId: this.metadata.name,
            referer: `https://${this.metadata.domain}/`,
          }
        );
        const chaptersList = Array.isArray(queryRes?.data) ? queryRes.data : [];
        const matched = chaptersList.find(
          (c: any) => String(c.id) === chapterSlug || c.chapter_slug === chapterSlug
        );
        if (matched) {
          seriesSlug = matched.series?.series_slug || seriesSlug;
          chapterSlug = matched.chapter_slug || chapterSlug;
        }
      } catch {
        // Fall back to direct request attempt
      }
    }

    if (seriesSlug && chapterSlug) {
      try {
        const data = await sourceHttpClient.fetchJson<any>(
          `https://${this.apiDomain}/chapter/${seriesSlug}/${chapterSlug}`,
          {
            sourceId: this.metadata.name,
            referer: `https://${this.metadata.domain}/`,
          }
        );
        const images =
          data?.chapter?.chapter_data?.images ||
          data?.chapter_data?.images ||
          data?.data?.images ||
          data?.images;

        if (Array.isArray(images) && images.length) {
          return images
            .map((image: any, index: number) => {
              const raw = typeof image === 'string' ? image : image?.url || image?.src;
              if (!raw) return null;
              return {
                index,
                url: this.normalizeChapterImageUrl(raw),
                headers: this.getRequestHeaders(),
              };
            })
            .filter(Boolean) as SourcePage[];
        }
      } catch {
        // Fallback to HTML scrape
      }
    }

    const fallbackPath = seriesSlug && chapterSlug ? `/series/${seriesSlug}/${chapterSlug}` : chapter.url;
    const fullUrl = fallbackPath.startsWith('http')
      ? fallbackPath
      : `https://${this.metadata.domain}${fallbackPath.startsWith('/') ? '' : '/'}${fallbackPath}`;

    const $ = await this.fetchHtml(fullUrl);
    const pages: SourcePage[] = [];

    // Kotatsu HeanCms image selector: .flex > img:not([alt]), main section img, #reader img, etc.
    const imgs = $('.flex > img, main section img, #reader img, .chapter-container img, img.chapter-img');

    imgs.each((index, el) => {
      const img = $(el);
      const src =
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        img.attr('data-original') ||
        img.attr('src') ||
        '';

      if (src && !src.includes('data:image') && !src.includes('logo') && !src.includes('banner')) {
        pages.push({
          index,
          url: src.startsWith('http') ? src : this.toAbsoluteUrl(src),
          headers: this.getRequestHeaders(),
        });
      }
    });

    return pages;
  }

  private normalizeChapterImageUrl(value: string): string {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('//')) return `https:${value}`;
    return `https://${this.apiDomain}/${value.replace(/^\/+/, '')}`;
  }

  private extractSlug(url: string): string {
    const clean = url.replace(/\/+$/, '');
    const parts = clean.split('/');
    return parts[parts.length - 1];
  }

  private async fetchSeries(slug: string): Promise<any> {
    let targetSlug = slug;

    // If slug is numeric (e.g. "54"), resolve the canonical series_slug from chapter query
    if (/^\d+$/.test(targetSlug)) {
      try {
        const queryRes = await sourceHttpClient.fetchJson<any>(
          `https://${this.apiDomain}/chapter/query?page=1&perPage=1&series_id=${targetSlug}`,
          {
            sourceId: this.metadata.name,
            referer: `https://${this.metadata.domain}/`,
          }
        );
        const resolved = queryRes?.data?.[0]?.series?.series_slug;
        if (resolved) {
          targetSlug = resolved;
        }
      } catch {
        // Fall back to targetSlug
      }
    }

    // 1. Direct series slug endpoint: /series/{series_slug}
    try {
      const data = await sourceHttpClient.fetchJson<any>(`https://${this.apiDomain}/series/${targetSlug}`, {
        sourceId: this.metadata.name,
        referer: `https://${this.metadata.domain}/`,
      });
      if (data?.id || data?.title) {
        return data;
      }
    } catch {
      // Fall through to query endpoint
    }

    // 2. Query search fallback
    try {
      const query = encodeURIComponent(targetSlug);
      const result = await sourceHttpClient.fetchJson<any>(
        `https://${this.apiDomain}/query?query_string=${query}&series_type=Comic&perPage=1&page=1`,
        {
          sourceId: this.metadata.name,
          referer: `https://${this.metadata.domain}/`,
        }
      );
      const queried = Array.isArray(result?.data) ? result.data[0] : result?.data;
      if (queried) return queried;
    } catch {
      // Final attempt: rethrow or return null
    }

    return null;
  }
}
