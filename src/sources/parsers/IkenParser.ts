/**
 * Iken / Next.js Engine Parser
 * Ported from Kotatsu's site/iken/IkenParser.kt
 * Powers VortexScans, MangaGalaxy, etc.
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

export class IkenParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  private get apiBaseUrl(): string {
    return this.metadata.baseUrl || `https://${this.metadata.domain}`;
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: `${this.apiBaseUrl}/`,
      Accept: 'application/json, text/plain, */*',
    };
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const query = filter.query ? encodeURIComponent(filter.query.trim()) : '';

    const url = `${this.apiBaseUrl}/api/query?page=${page}&perPage=18&searchTerm=${query}`;

    let data;
    try {
      data = await sourceHttpClient.fetchJson<any>(url, {
        sourceId: this.metadata.name,
        referer: `${this.apiBaseUrl}/`,
      });
    } catch {
      // Fallback without api subdomain
      const fallbackUrl = `https://${this.metadata.domain}/api/query?page=${page}&perPage=18&searchTerm=${query}`;
      data = await sourceHttpClient.fetchJson<any>(fallbackUrl, {
        sourceId: this.metadata.name,
        referer: `https://${this.metadata.domain}/`,
      });
    }

    const posts = this.extractItems(data);

    return posts.map((item: any) => {
      const slug = item.slug || String(item.id);
      const title = item.postTitle || item.title || slug;

      let coverUrl: string | null = null;
      if (item.featuredImage) {
        coverUrl = item.featuredImage.startsWith('http')
          ? item.featuredImage
          : `https://${this.metadata.domain}/${item.featuredImage.replace(/^\/+/, '')}`;
      }

      let rating: number | undefined = undefined;
      if (typeof item.averageRating === 'number' && item.averageRating > 0) {
        rating = Math.round(item.averageRating * 10) / 10;
      }

      const genres: string[] = [];
      if (Array.isArray(item.genres)) {
        for (const g of item.genres) {
          const name = typeof g === 'string' ? g : g?.name || g?.title;
          if (name) genres.push(name);
        }
      }

      return {
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        title: this.cleanText(title),
        url: `/series/${slug}`,
        publicUrl: `${this.apiBaseUrl}/series/${slug}`,
        coverUrl,
        rating,
        tags: genres.slice(0, 15),
        state: item.seriesStatus === 'COMPLETED' ? 'completed' : 'ongoing',
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
      let post: any = null;
      try {
        const data = await sourceHttpClient.fetchJson<any>(
          `${this.apiBaseUrl}/api/query?slug=${encodeURIComponent(slug)}`,
          {
            sourceId: this.metadata.name,
            referer: `${this.apiBaseUrl}/`,
          }
        );
        post = this.extractItems(data)[0];
      } catch {
        // Fallback below
      }

      if (!post) {
        const data = await sourceHttpClient.fetchJson<any>(
          `${this.apiBaseUrl}/api/query?searchTerm=${encodeURIComponent(slug)}&perPage=1`,
          {
            sourceId: this.metadata.name,
            referer: `${this.apiBaseUrl}/`,
          }
        );
        post = this.extractItems(data)[0];
      }

      if (!post) return manga;

      const genres: string[] = [];
      if (Array.isArray(post.genres)) {
        for (const g of post.genres) {
          const name = typeof g === 'string' ? g : g?.name || g?.title;
          if (name) genres.push(name);
        }
      }

      return {
        ...manga,
        title: post.postTitle || manga.title,
        coverUrl: post.featuredImage || manga.coverUrl,
        tags: genres.length ? genres.slice(0, 15) : manga.tags,
        state: post.seriesStatus === 'COMPLETED' ? 'completed' : 'ongoing',
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

    try {
      let post: any = null;
      try {
        const data = await sourceHttpClient.fetchJson<any>(
          `${this.apiBaseUrl}/api/query?slug=${encodeURIComponent(slug)}`,
          {
            sourceId: this.metadata.name,
            referer: `${this.apiBaseUrl}/`,
          }
        );
        post = this.extractItems(data)[0];
      } catch {
        // Fallback below
      }

      if (!post) {
        const data = await sourceHttpClient.fetchJson<any>(
          `${this.apiBaseUrl}/api/query?searchTerm=${encodeURIComponent(slug)}&perPage=1`,
          {
            sourceId: this.metadata.name,
            referer: `${this.apiBaseUrl}/`,
          }
        );
        post = this.extractItems(data)[0];
      }

      const postId = post?.id ?? post?.series?.id ?? post?.seriesId;
      const postSlug = post?.slug ?? post?.series?.slug ?? slug;

      let chapters: any[] = [];
      if (postId) {
        try {
          const chapterData = await sourceHttpClient.fetchJson<any>(
            `${this.apiBaseUrl}/api/chapters?postId=${encodeURIComponent(String(postId))}`,
            {
              sourceId: this.metadata.name,
              referer: `${this.apiBaseUrl}/`,
            }
          );
          chapters = Array.isArray(chapterData?.post?.chapters)
            ? chapterData.post.chapters
            : Array.isArray(chapterData?.chapters)
              ? chapterData.chapters
              : [];
        } catch {
          // Fallback below
        }
      }

      if (!chapters.length && Array.isArray(post?.chapters)) {
        chapters = post.chapters;
      }

      return chapters.map((ch: any, idx: number) => {
        const num = typeof ch.number === 'number' ? ch.number : idx + 1;
        const chSlug = ch.slug || `chapter-${num}`;
        const chName = ch.title || `Chapter ${num}`;
        const chUrl = `/series/${postSlug}/${chSlug}`;

        return {
          id: `${this.metadata.id}:${postSlug}:${chSlug}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name: chName,
          number: num,
          url: chUrl,
          dateUpload: ch.createdAt ? Date.parse(ch.createdAt) : undefined,
        };
      });
    } catch {
      return [];
    }
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    let postSlug = '';
    let chSlug = '';

    // Case 1: chapter.url is /series/{slug}/{chSlug}
    const urlMatch = chapter.url.match(/\/series\/([^/]+)\/([^/?#]+)/i);
    if (urlMatch) {
      postSlug = urlMatch[1];
      chSlug = urlMatch[2];
    } else {
      // Case 2: Parse from chapter.id
      const idParts = chapter.id.split(':');
      if (idParts.length >= 3) {
        postSlug = idParts[idParts.length - 2];
        chSlug = idParts[idParts.length - 1];
      } else if (chapter.url.includes(':')) {
        const rawParts = chapter.url.split(':');
        postSlug = rawParts[0];
        chSlug = rawParts[1];
      } else if (idParts.length === 2) {
        chSlug = idParts[1];
      }
    }

    const targetPath = postSlug && chSlug ? `/series/${postSlug}/${chSlug}` : chapter.url;
    const fullUrl = targetPath.startsWith('http')
      ? targetPath
      : `${this.apiBaseUrl}${targetPath.startsWith('/') ? '' : '/'}${targetPath}`;

    const $ = await this.fetchHtml(fullUrl);
    const pages: SourcePage[] = [];

    // 1. Vortex reader-page-image selector
    $('img[data-reader-page-image="true"]').each((index, el) => {
      const img = $(el);
      const src = img.attr('src') || img.attr('data-src') || '';
      const pageIdx = parseInt(img.attr('data-reader-index') || String(index), 10);
      if (src && !src.includes('logo') && !src.includes('featured')) {
        pages.push({
          index: isNaN(pageIdx) ? index : pageIdx,
          url: src.startsWith('http') ? src : this.toAbsoluteUrl(src),
          headers: this.getRequestHeaders(),
        });
      }
    });

    if (pages.length > 0) {
      return pages.sort((a, b) => a.index - b.index);
    }

    // 2. Kotatsu Iken script tag with "images" JSON
    $('script').each((_, el) => {
      const scriptText = $(el).text();
      if (scriptText.includes('"images"')) {
        try {
          const match = scriptText.match(/"images":\s*(\[[^\]]+\])/);
          if (match && match[1]) {
            const arr = JSON.parse(match[1]);
            if (Array.isArray(arr)) {
              arr.forEach((item: any, i: number) => {
                const imgUrl = typeof item === 'string' ? item : item?.url;
                if (imgUrl) {
                  pages.push({
                    index: i,
                    url: imgUrl.startsWith('http') ? imgUrl : this.toAbsoluteUrl(imgUrl),
                    headers: this.getRequestHeaders(),
                  });
                }
              });
            }
          }
        } catch {
          // ignore json parse error
        }
      }
    });

    if (pages.length > 0) {
      return pages.sort((a, b) => a.index - b.index);
    }

    // 3. Fallback to DOM elements
    $('main section img, .chapter-content img, .reader-area img, img.chapter-img').each((index, el) => {
      const img = $(el);
      const src =
        img.attr('data-src') ||
        img.attr('data-lazy-src') ||
        img.attr('data-original') ||
        img.attr('src') ||
        '';

      if (
        src &&
        !src.includes('data:image') &&
        !src.includes('logo') &&
        !src.includes('featured') &&
        !src.includes('banner')
      ) {
        pages.push({
          index,
          url: src.startsWith('http') ? src : this.toAbsoluteUrl(src),
          headers: this.getRequestHeaders(),
        });
      }
    });

    return pages.sort((a, b) => a.index - b.index);
  }

  private normalizeChapterImageUrl(value: string): string {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('//')) return `https:${value}`;
    return `https://${this.metadata.domain}/${value.replace(/^\/+/, '')}`;
  }

  private extractItems(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.posts)) return data.posts;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.posts)) return data.data.posts;
    return data?.data && typeof data.data === 'object' ? [data.data] : [];
  }

  private extractSlug(url: string): string {
    const clean = url.replace(/\/+$/, '');
    const parts = clean.split('/');
    return parts[parts.length - 1];
  }
}
