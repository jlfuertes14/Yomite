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
  SourceSortOption,
  SourceTag,
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

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Chapter' },
    ];
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'Action', label: 'Action', group: 'Genre' },
      { id: 'Fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'Manhwa', label: 'Manhwa', group: 'Genre' },
      { id: 'Adventure', label: 'Adventure', group: 'Genre' },
      { id: 'Martial Arts', label: 'Martial Arts', group: 'Genre' },
      { id: 'Comedy', label: 'Comedy', group: 'Genre' },
      { id: 'Drama', label: 'Drama', group: 'Genre' },
      { id: 'Mystery', label: 'Mystery', group: 'Genre' },
      { id: 'Romance', label: 'Romance', group: 'Genre' },
      { id: 'Sci-Fi', label: 'Sci-Fi', group: 'Genre' },
      { id: 'Supernatural', label: 'Supernatural', group: 'Genre' },
      { id: 'Historical', label: 'Historical', group: 'Genre' },
      { id: 'Horror', label: 'Horror', group: 'Genre' },
      { id: 'Psychological', label: 'Psychological', group: 'Genre' },
      { id: 'School Life', label: 'School Life', group: 'Genre' },
      { id: 'Shounen', label: 'Shounen', group: 'Genre' },
      { id: 'Slice of Life', label: 'Slice of Life', group: 'Genre' },
      { id: 'Tragedy', label: 'Tragedy', group: 'Genre' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const searchTerm = filter.query?.trim()
      ? filter.query.trim()
      : filter.tags && filter.tags.length > 0
      ? filter.tags[0]
      : '';
    const query = encodeURIComponent(searchTerm);

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

    if (posts.length === 0 && !query) {
      // HTML fallback for series catalog if API returns empty
      try {
        const $ = await this.fetchHtml(`${this.apiBaseUrl}/series?page=${page}`);
        const scraped: SourceManga[] = [];
        $('a[href*="/series/"]').each((_, el) => {
          const $a = $(el);
          const href = $a.attr('href') || '';
          const match = href.match(/\/series\/([^/?#]+)$/i);
          if (match && match[1] && !['series', 'all', 'genres', 'filter'].includes(match[1])) {
            const slug = match[1];
            if (!scraped.some((s) => s.id.endsWith(`:${slug}`))) {
              const title =
                this.cleanText($a.find('h2, h3, h4, p, span').first().text()) ||
                $a.text().trim();
              const img =
                $a.find('img').first().attr('src') ||
                $a.find('img').first().attr('data-src');
              if (title) {
                scraped.push({
                  id: `${this.metadata.id}:${slug}`,
                  sourceId: this.metadata.id,
                  title,
                  url: `/series/${slug}`,
                  publicUrl: `${this.apiBaseUrl}/series/${slug}`,
                  coverUrl: img ? this.toAbsoluteUrl(img) : null,
                });
              }
            }
          }
        });
        if (scraped.length > 0) return scraped;
      } catch {
        // ignore
      }
    }

    return posts.map((item: any) => {
      const slug = item.slug || String(item.id);
      const title = item.postTitle || item.title || slug;

      let coverUrl: string | null = null;
      const rawCover =
        item.featuredImage ||
        item.featured_image ||
        item.cover ||
        item.coverUrl ||
        item.thumbnail ||
        item.image ||
        item.poster ||
        item.featuredImageUrl;
      if (rawCover) {
        coverUrl = rawCover.startsWith('http')
          ? rawCover
          : `https://${this.metadata.domain}/${rawCover.replace(/^\/+/, '')}`;
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

      const authors: string[] = [];
      if (typeof item.author === 'string' && item.author.trim()) {
        authors.push(this.cleanText(item.author));
      } else if (typeof item.postAuthor === 'string' && item.postAuthor.trim()) {
        authors.push(this.cleanText(item.postAuthor));
      } else if (typeof item.author?.name === 'string') {
        authors.push(this.cleanText(item.author.name));
      } else if (Array.isArray(item.authors)) {
        for (const a of item.authors) {
          const name = typeof a === 'string' ? a : a?.name;
          if (name) authors.push(this.cleanText(name));
        }
      }

      const rawDesc = item.postContent || item.description || item.summary || '';
      const description = rawDesc ? this.stripHtml(rawDesc) : undefined;

      return {
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        title: this.cleanText(title),
        url: `/series/${slug}`,
        publicUrl: `${this.apiBaseUrl}/series/${slug}`,
        coverUrl,
        rating,
        authors: authors.length ? authors : undefined,
        description,
        tags: genres.slice(0, 15),
        state: item.seriesStatus === 'COMPLETED' ? 'completed' : 'ongoing',
      };
    });
  }

  /**
   * Helper to locate post metadata and postId by slug using API queries and HTML SSR
   */
  private async fetchPost(
    slug: string,
    titleHint?: string
  ): Promise<{ post: any; postId?: number | string; html?: string; chapters?: any[] }> {
    const cleanSlug = slug.trim().toLowerCase();

    // 1. Search with title hint or slug with spaces
    const queries = [
      titleHint ? titleHint.trim() : '',
      slug.replace(/[-_]+/g, ' ').trim(),
      slug.trim(),
    ].filter(Boolean);

    for (const q of queries) {
      try {
        const searchUrl = `${this.apiBaseUrl}/api/query?searchTerm=${encodeURIComponent(q)}&perPage=10`;
        const res = await sourceHttpClient.fetchJson<any>(searchUrl, {
          sourceId: this.metadata.name,
          referer: `${this.apiBaseUrl}/`,
        });
        const items = this.extractItems(res);
        const exact = items.find((it: any) => {
          const itSlug = (it.slug || String(it.id || '')).trim().toLowerCase();
          return itSlug === cleanSlug;
        });
        if (exact) {
          const postId = exact.id ?? exact.postId ?? exact.seriesId;
          return { post: exact, postId };
        }
      } catch {
        // try next query
      }
    }

    // 2. Search in general query list
    try {
      const listData = await sourceHttpClient.fetchJson<any>(
        `${this.apiBaseUrl}/api/query?perPage=50`,
        {
          sourceId: this.metadata.name,
          referer: `${this.apiBaseUrl}/`,
        }
      );
      const items = this.extractItems(listData);
      const found = items.find((it: any) => {
        const itSlug = (it.slug || String(it.id || '')).trim().toLowerCase();
        return itSlug === cleanSlug;
      });
      if (found) {
        const postId = found.id ?? found.postId ?? found.seriesId;
        return { post: found, postId };
      }
    } catch {
      // fallback to HTML
    }

    // 3. Fallback: Fetch Series HTML page (SSR / TanStack Router)
    try {
      const seriesPageUrl = `${this.apiBaseUrl}/series/${slug}`;
      const $ = await this.fetchHtml(seriesPageUrl);
      const htmlText = $.html() || '';

      // Extract postId
      let postId: string | undefined = undefined;
      const idMatch =
        htmlText.match(new RegExp(`id\\s*:\\s*(\\d+)\\s*,\\s*slug\\s*:\\s*["']${slug}["']`, 'i')) ||
        htmlText.match(new RegExp(`slug\\s*:\\s*["']${slug}["'][\\s\\S]*?id\\s*:\\s*(\\d+)`, 'i')) ||
        htmlText.match(/post:\s*\{[^}]*?id\s*:\s*(\d+)/i) ||
        htmlText.match(/postId["']?\s*[:=]\s*["']?(\d+)/i);
      if (idMatch && idMatch[1]) {
        postId = idMatch[1];
      }

      // Extract description
      let description = '';
      const descMatch = htmlText.match(/postContent\s*:\s*"([^"]+)"/i);
      if (descMatch && descMatch[1]) {
        description = descMatch[1]
          .replace(/\\x3C/g, '<')
          .replace(/\\"/g, '"')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      if (!description) {
        const metaDesc =
          $('meta[property="og:description"]').attr('content') ||
          $('meta[name="description"]').attr('content') ||
          '';
        const descText = this.stripHtml(
          $('[class*="description"], [class*="synopsis"], .description, .synopsis, p.text-sm').first().text()
        );
        description =
          !metaDesc || /read free|vortex scans/i.test(metaDesc)
            ? descText
            : this.cleanText(metaDesc);
      }

      // Extract title
      const titleMatch = htmlText.match(/postTitle\s*:\s*"([^"]+)"/i);
      const postTitle = titleMatch ? titleMatch[1] : this.cleanText($('h1').first().text());

      // Extract cover
      const coverMatch = htmlText.match(/featuredImage\s*:\s*"([^"]+)"/i);
      const featuredImage = coverMatch
        ? coverMatch[1]
        : $('meta[property="og:image"]').attr('content') ||
          $('img[src*="featured"], img[src*="cover"]').first().attr('src');

      // Extract author
      const authorMatch = htmlText.match(/author\s*:\s*"([^"]+)"/i);
      const artistMatch = htmlText.match(/artist\s*:\s*"([^"]+)"/i);
      const author = authorMatch && authorMatch[1].trim() ? authorMatch[1] : undefined;
      const artist = artistMatch && artistMatch[1].trim() ? artistMatch[1] : undefined;

      // Extract regex chapters from HTML
      const chRegex = /\{id:(\d+),slug:"([^"]+)",number:([\d.]+)(?:,title:"([^"]*)")?/g;
      const parsedChapters: any[] = [];
      let m;
      while ((m = chRegex.exec(htmlText)) !== null) {
        parsedChapters.push({
          id: m[1],
          slug: m[2],
          number: parseFloat(m[3]),
          title: m[4] || '',
        });
      }

      const postObj = {
        id: postId,
        slug,
        postTitle,
        description,
        postContent: description,
        featuredImage,
        author,
        artist,
        chapters: parsedChapters,
      };

      return { post: postObj, postId, html: htmlText, chapters: parsedChapters };
    } catch {
      // ignore
    }

    return { post: null };
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const rawSlug = this.extractSlug(manga.url);
    const slug =
      rawSlug && rawSlug !== this.metadata.id
        ? rawSlug
        : manga.id.replace(new RegExp(`^${this.metadata.id}:`), '');

    try {
      const { post } = await this.fetchPost(slug, manga.title);

      if (post) {
        const genres: string[] = [];
        if (Array.isArray(post.genres)) {
          for (const g of post.genres) {
            const name = typeof g === 'string' ? g : g?.name || g?.title;
            if (name) genres.push(name);
          }
        }

        const authors: string[] = [];
        if (typeof post.author === 'string' && post.author.trim()) {
          authors.push(this.cleanText(post.author));
        } else if (typeof post.postAuthor === 'string' && post.postAuthor.trim()) {
          authors.push(this.cleanText(post.postAuthor));
        } else if (typeof post.author?.name === 'string' && post.author.name.trim()) {
          authors.push(this.cleanText(post.author.name));
        } else if (Array.isArray(post.authors)) {
          for (const a of post.authors) {
            const name = typeof a === 'string' ? a : a?.name || a?.title;
            if (name) authors.push(this.cleanText(name));
          }
        } else if (Array.isArray(post.taxonomies?.author)) {
          for (const a of post.taxonomies.author) {
            const name = typeof a === 'string' ? a : a?.name || a?.title;
            if (name) authors.push(this.cleanText(name));
          }
        }
        if (typeof post.artist === 'string' && post.artist.trim() && !authors.length) {
          authors.push(this.cleanText(post.artist));
        }

        const rawDesc =
          post.postContent ||
          post.description ||
          post.summary ||
          post.content ||
          post.excerpt ||
          '';
        const description = this.stripHtml(rawDesc) || manga.description;

        const rawCover =
          post.featuredImage ||
          post.featured_image ||
          post.cover ||
          post.coverUrl ||
          post.thumbnail ||
          post.image ||
          post.poster;
        const coverUrl = rawCover ? this.toAbsoluteUrl(rawCover) : manga.coverUrl;

        return {
          ...manga,
          title: this.cleanText(post.postTitle || post.title || manga.title),
          coverUrl: coverUrl || manga.coverUrl,
          description: description || manga.description,
          authors: authors.length ? authors : manga.authors,
          tags: genres.length ? genres.slice(0, 15) : manga.tags,
          state: post.seriesStatus === 'COMPLETED' ? 'completed' : 'ongoing',
        };
      }
    } catch {
      // Fallback below
    }

    return manga;
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const rawSlug = this.extractSlug(manga.url);
    const slug =
      rawSlug && rawSlug !== this.metadata.id
        ? rawSlug
        : manga.id.replace(new RegExp(`^${this.metadata.id}:`), '');

    try {
      const { post, postId, chapters: fallbackChapters } = await this.fetchPost(
        slug,
        manga.title
      );
      const effectivePostId = postId ?? post?.id ?? post?.series?.id ?? post?.seriesId;
      const postSlug = post?.slug ?? post?.series?.slug ?? slug;

      let chapters: any[] = [];
      if (effectivePostId) {
        try {
          const chapterData = await sourceHttpClient.fetchJson<any>(
            `${this.apiBaseUrl}/api/chapters?postId=${encodeURIComponent(String(effectivePostId))}`,
            {
              sourceId: this.metadata.name,
              referer: `${this.apiBaseUrl}/`,
            }
          );
          chapters = Array.isArray(chapterData?.post?.chapters)
            ? chapterData.post.chapters
            : Array.isArray(chapterData?.chapters)
              ? chapterData.chapters
              : Array.isArray(chapterData?.data)
                ? chapterData.data
                : [];
        } catch {
          // Fallback below
        }
      }

      if (!chapters.length && Array.isArray(post?.chapters) && post.chapters.length > 0) {
        chapters = post.chapters;
      }
      if (!chapters.length && Array.isArray(fallbackChapters) && fallbackChapters.length > 0) {
        chapters = fallbackChapters;
      }

      return chapters.map((ch: any, idx: number) => {
        const num =
          typeof ch.number === 'number'
            ? ch.number
            : this.parseChapterNumber(ch.slug || ch.title || String(idx + 1));
        const chSlug = ch.slug || `chapter-${num}`;
        const chName = ch.title && ch.title.trim() ? ch.title.trim() : `Chapter ${num}`;
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
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.posts)) return data.posts;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.posts)) return data.data.posts;
    if (Array.isArray(data?.data?.data)) return data.data.data;
    if (Array.isArray(data?.data?.series)) return data.data.series;
    if (Array.isArray(data?.series)) return data.series;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.items)) return data.items;
    if (data?.post && typeof data.post === 'object') return [data.post];
    if (data?.series && typeof data.series === 'object') return [data.series];
    if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) return [data.data];
    return [];
  }

  private extractSlug(url: string): string {
    const clean = url.replace(/\/+$/, '');
    const parts = clean.split('/');
    return parts[parts.length - 1];
  }
}
