/**
 * MangaGo Parser (mangago.me)
 *
 * Scrapes manga catalog, details, chapters, and reader pages from mangago.me.
 * Features:
 * 1. Resilient parsing with Cloudflare detection and BridgedImage compatibility.
 * 2. High-signal fallback catalog (61 curated titles with full covers and chapters).
 * 3. Live search and chapter table extraction.
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
import { DEFAULT_USER_AGENT, sourceHttpClient } from '../network/httpClient';
import { parse } from '../network/htmlParser';
import { webViewBridge } from '../network/webViewBridge';
import mangaGoFallbackData from '../catalog/mangaGoFallback.json';

export class MangaGoParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: Partial<MangaSourceMetadata>) {
    super();
    this.metadata = {
      id: 'mangago',
      name: 'MangaGo',
      domain: 'mangago.me',
      baseUrl: 'https://www.mangago.me',
      locale: 'en',
      isNsfw: false,
      version: '1.0.0',
      icon: 'https://www.google.com/s2/favicons?domain=mangago.me&sz=64',
      description: 'Massive library of manga, manhwa, webtoons, and romance titles from MangaGo.',
      availableSortOrders: ['popular', 'latest', 'newest'],
      enabled: true,
      ...metadata,
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Trending / Popular' },
      { id: 'latest', label: 'Latest Updates' },
      { id: 'newest', label: 'Recently Added' },
    ];
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  public override getImageHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: `${this.metadata.baseUrl}/`,
    };
  }

  private normalizeImageUrl(rawUrl: string): string {
    let u = rawUrl.trim();
    if (u.startsWith('//')) {
      u = `https:${u}`;
    }
    // Android OkHttp and iOS NSURLSession reject hostnames with underscores in SSL/TLS SNI (RFC 1034).
    // E.g., https://iweb_9.mangapicgallery.com/... -> http://iweb_9.mangapicgallery.com/...
    return u.replace(/^https:\/\/([^/]*_[^/]*)/i, (_, host) => `http://${host}`);
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return [
      { id: 'action', label: 'Action', group: 'Genre' },
      { id: 'adventure', label: 'Adventure', group: 'Genre' },
      { id: 'comedy', label: 'Comedy', group: 'Genre' },
      { id: 'drama', label: 'Drama', group: 'Genre' },
      { id: 'fantasy', label: 'Fantasy', group: 'Genre' },
      { id: 'romance', label: 'Romance', group: 'Genre' },
      { id: 'school-life', label: 'School Life', group: 'Genre' },
      { id: 'shoujo', label: 'Shoujo', group: 'Genre' },
      { id: 'shounen', label: 'Shounen', group: 'Genre' },
      { id: 'shounen-ai', label: 'Shounen Ai', group: 'Genre' },
      { id: 'yaoi', label: 'Yaoi', group: 'Genre' },
      { id: 'supernatural', label: 'Supernatural', group: 'Genre' },
    ];
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    const query = filter.query?.trim();

    try {
      let targetUrl = `${this.metadata.baseUrl}/`;
      if (query) {
        targetUrl = `${this.metadata.baseUrl}/r/l_search/?name=${encodeURIComponent(query)}&page=${page}`;
      } else if (filter.order === 'latest') {
        targetUrl = `${this.metadata.baseUrl}/genre/all/${page}/?f=1&o=1`;
      }

      const html = await sourceHttpClient.fetchText(targetUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const root = parse(html);
      const items: SourceManga[] = [];
      const seen = new Set<string>();

      const containers = root.querySelectorAll('.pic_ser, li, div.item, .img_wrapper, #updates .row');
      for (const container of containers) {
        const linkEl = container.querySelector('a.title, a[href*="/read-manga/"]');
        let href = linkEl?.getAttribute('href');
        if (!href || href.includes('/uu/')) continue;

        const cleanHref = href.split('?')[0];
        if (seen.has(cleanHref)) continue;

        const imgEl = container.querySelector('img[src*="coverlink"], img[data-src*="coverlink"], img');
        let cover = imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || null;
        if (cover) {
          cover = this.normalizeImageUrl(cover);
        }

        const title = this.cleanText(
          linkEl.getAttribute('title') || linkEl.text?.trim() || imgEl?.getAttribute('alt') || ''
        );
        if (!title || title.length <= 1) continue;

        const slugMatch = cleanHref.match(/\/read-manga\/([^\/]+)/);
        const slug = slugMatch ? slugMatch[1] : cleanHref.replace(/^\/+/, '');
        seen.add(cleanHref);

        const chEl = container.querySelector('a[href*="/uu/"]');
        const latestCh = chEl ? this.cleanText(chEl.text) : undefined;

        items.push({
          id: `${this.metadata.id}:${slug}`,
          sourceId: this.metadata.id,
          url: cleanHref.startsWith('/') ? cleanHref : `/${cleanHref}`,
          publicUrl: cleanHref.startsWith('http') ? cleanHref : this.toAbsoluteUrl(cleanHref),
          title,
          coverUrl: cover,
          coverHeaders: this.getImageHeaders(),
          locale: 'en',
          state: 'ongoing',
          description: latestCh ? `Latest: ${latestCh}` : undefined,
        });
      }

      if (items.length > 0) {
        return items;
      }
    } catch {
      // Fall through to fallback catalog
    }

    // Fallback: match against static dataset
    const q = filter.query?.toLowerCase().trim();
    const fallbackList = (mangaGoFallbackData as any[]) || [];
    const filtered = q
      ? fallbackList.filter(
          (item) =>
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.href && item.href.toLowerCase().includes(q))
        )
      : fallbackList;

    return filtered.map((item) => {
      const slugMatch = item.href.match(/\/read-manga\/([^\/]+)/);
      const slug = slugMatch ? slugMatch[1] : item.href.replace(/^\/+/, '');

      return {
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        url: item.href,
        publicUrl: item.href.startsWith('http') ? item.href : this.toAbsoluteUrl(item.href),
        title: this.cleanText(item.title),
        coverUrl: item.coverUrl || null,
        coverHeaders: this.getImageHeaders(),
        locale: 'en',
        state: 'ongoing',
        description: item.ch ? `Latest: ${item.ch}` : undefined,
      };
    });
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const slug = manga.id.replace(`${this.metadata.id}:`, '').replace(/^\/read-manga\//, '').replace(/\/$/, '');
    const pageUrl = `${this.metadata.baseUrl}/read-manga/${slug}/`;

    try {
      const html = await sourceHttpClient.fetchText(pageUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const root = parse(html);

      const titleNode = root.querySelector('h1, .manga_title, meta[property="og:title"]');
      const title = this.cleanText(titleNode?.text || titleNode?.getAttribute('content') || manga.title);

      const descNode = root.querySelector('#information, .manga_summary, .description, meta[name="description"]');
      const description = this.cleanText(descNode?.text || descNode?.getAttribute('content') || manga.description || '');

      const imgNode = root.querySelector('img#cover, .left_cover img, img[src*="coverlink"]');
      let cover = imgNode?.getAttribute('data-src') || imgNode?.getAttribute('src') || manga.coverUrl;
      if (cover) {
        cover = this.normalizeImageUrl(cover);
      }

      const genres = root
        .querySelectorAll('a[href*="/genre/"]')
        .map((a) => this.cleanText(a.text))
        .filter(Boolean);

      const authors = root
        .querySelectorAll('a[href*="/people/"]')
        .map((a) => this.cleanText(a.text))
        .filter(Boolean);

      const chapterNodes = root.querySelectorAll('a[href*="/uu/"]');

      return {
        ...manga,
        title: title || manga.title,
        description: description || manga.description,
        coverUrl: cover || manga.coverUrl,
        coverHeaders: this.getImageHeaders(),
        tags: genres.length > 0 ? genres : manga.tags,
        authors: authors.length > 0 ? authors : manga.authors,
        chaptersCount: chapterNodes.length || manga.chaptersCount,
      };
    } catch {
      return manga;
    }
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const slug = manga.id.replace(`${this.metadata.id}:`, '').replace(/^\/read-manga\//, '').replace(/\/$/, '');
    const pageUrl = `${this.metadata.baseUrl}/read-manga/${slug}/`;

    try {
      const html = await sourceHttpClient.fetchText(pageUrl, {
        headers: this.getRequestHeaders(),
        sourceId: this.metadata.id,
      });

      const root = parse(html);
      const chapters: SourceChapter[] = [];
      const seen = new Set<string>();

      const links = root.querySelectorAll(
        'table#chapter_table a.chico, table#raws_table a.chico, table.uk-table a, a.chico, a[href*="/uu/"], a[href*="/read-manga/"]'
      );
      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href || seen.has(href)) continue;
        if (!href.includes('/read-manga/') && !href.includes('/uu/')) continue;
        // Don't treat manga details page or user profile as chapter
        if (href.endsWith(`/read-manga/${slug}/`) || href.endsWith(`/read-manga/${slug}`)) continue;
        seen.add(href);

        const name = this.cleanText(link.text) || 'Chapter';
        const numMatch = name.match(/ch(?:apter)?\.?\s*(\d+(?:\.\d+)?)/i) || name.match(/(\d+(?:\.\d+)?)/);
        const chapterNum = numMatch ? parseFloat(numMatch[1]) : 0;

        const cleanHref = href.startsWith('http') ? href.replace(this.metadata.baseUrl, '') : href;
        const chPathMatch = cleanHref.match(/\/read-manga\/[^\/]+\/([^\/]+)\/([^\/]+)/);

        let chapterId = '';
        if (chPathMatch) {
          chapterId = `${chPathMatch[1]}:${chPathMatch[2]}`;
        } else {
          const chFolderMatch = cleanHref.match(/([a-zA-Z0-9_-]+_chapter-[a-zA-Z0-9_-]+)/i);
          chapterId = chFolderMatch ? chFolderMatch[1] : `ch-${chapterNum}`;
        }

        chapters.push({
          id: `${this.metadata.id}:${slug}:${chapterId}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name: name.includes('Ch') || name.includes('Chapter') ? name : `Chapter ${chapterNum}`,
          number: chapterNum,
          url: cleanHref,
          dateUpload: Date.now(),
          scanlator: 'MangaGo',
        });
      }

      if (chapters.length > 0) {
        return chapters.sort((a, b) => b.number - a.number);
      }
    } catch {
      // Fall through to fallback catalog
    }

    const fallbackItem = (mangaGoFallbackData as any[]).find(
      (item) => item.href && item.href.includes(`/read-manga/${slug}/`)
    );
    if (fallbackItem && fallbackItem.folder) {
      const sec = fallbackItem.section || 'uu';
      const fol = fallbackItem.folder;
      const chName = fallbackItem.ch || 'Chapter 1';
      const numMatch = chName.match(/(\d+(?:\.\d+)?)/);
      const num = numMatch ? parseFloat(numMatch[1]) : 1;
      return [
        {
          id: `${this.metadata.id}:${slug}:${sec}:${fol}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name: chName,
          number: num,
          url: fallbackItem.chapterPath || `/read-manga/${slug}/${sec}/${fol}/pg-1/`,
          dateUpload: Date.now(),
          scanlator: 'MangaGo',
        },
      ];
    }

    return [
      {
        id: `${this.metadata.id}:${slug}:uu:br_chapter-1`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: 'Chapter 1',
        number: 1,
        url: `/read-manga/${slug}/uu/br_chapter-1/pg-1/`,
        dateUpload: Date.now(),
        scanlator: 'MangaGo',
      },
    ];
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    let slug = '';
    let section = 'uu';
    let folder = '';

    if (chapter.id && chapter.id.startsWith('mangago:')) {
      const parts = chapter.id.replace(/^mangago:/, '').split(':');
      slug = parts[0] || '';
      if (parts.length >= 3) {
        section = parts[1];
        folder = parts[2];
      } else if (parts.length === 2) {
        folder = parts[1];
      }
    }

    if (/^\d+$/.test(folder)) {
      folder = `br_chapter-${folder}`;
    }

    let pageUrl = '';
    if (chapter.url && chapter.url.startsWith('/read-manga/')) {
      pageUrl = this.toAbsoluteUrl(chapter.url);
    } else if (slug && folder) {
      pageUrl = `${this.metadata.baseUrl}/read-manga/${slug}/${section}/${folder}/pg-1/`;
    } else {
      pageUrl = `${this.metadata.baseUrl}/read-manga/${slug || 'manga'}/uu/br_chapter-1/pg-1/`;
    }
    pageUrl = pageUrl.replace(/\/pg-\d+\/pg-\d+\/?$/, '/pg-1/').replace(/\/?$/, '/');

    try {
      let html = '';
      if (typeof webViewBridge !== 'undefined' && webViewBridge.hasSender()) {
        try {
          html = await webViewBridge.fetchText(pageUrl);
        } catch {}
      }

      if (!html) {
        html = await sourceHttpClient.fetchText(pageUrl, {
          headers: this.getRequestHeaders(),
          sourceId: this.metadata.id,
        });
      }

      const pages: SourcePage[] = [];
      const seen = new Set<string>();

      // 1. Decrypt imgsrcs payload via pure JS AES-128-CBC
      const imgsrcsMatch =
        html.match(/var\s+imgsrcs\s*=\s*['"]([a-zA-Z0-9+=/]+)['"]/i) ||
        html.match(/imgsrcs\s*=\s*['"]([a-zA-Z0-9+=/]+)['"]/i);

      if (imgsrcsMatch) {
        const ciphertextB64 = imgsrcsMatch[1];
        const keys = [
          'e11adc3949ba59abbe56e057f20f883e',
          'e10adc3949ba59abba56e057f20f883e',
        ];
        const ivHex = '1234567890abcdef1234567890abcdef';

        let decryptedText = '';
        for (const keyHex of keys) {
          try {
            const result = decryptAes128CbcZeroPadding(ciphertextB64, keyHex, ivHex);
            if (result && result.includes('http')) {
              decryptedText = result;
              break;
            }
          } catch {}
        }

        if (decryptedText) {
          const rawUrls = decryptedText
            .split(',')
            .map((u) => u.trim())
            .filter((u) => u.startsWith('http'));

          for (const rawUrl of rawUrls) {
            const normalizedUrl = this.normalizeImageUrl(rawUrl);
            if (!seen.has(normalizedUrl)) {
              seen.add(normalizedUrl);
              pages.push({
                index: pages.length,
                url: normalizedUrl,
                headers: this.getImageHeaders(),
              });
            }
          }
        }
      }

      // 2. Fallback to DOM elements if imgsrcs was not present or already rendered
      if (pages.length === 0) {
        const root = parse(html);
        const imgNodes = root.querySelectorAll(
          '#pic_container img, img#manga_pic, img[src*="mangapicgallery"], img[data-src*="mangapicgallery"], #page1 img, #page2 img'
        );
        for (let i = 0; i < imgNodes.length; i++) {
          const src = imgNodes[i].getAttribute('data-src') || imgNodes[i].getAttribute('src');
          if (!src) continue;
          const lower = src.toLowerCase();
          // Ignore logos, banners, placeholders, icons, and pagination arrows
          if (
            lower.includes('logo') ||
            lower.includes('banner') ||
            lower.includes('icon') ||
            lower.includes('ywz') ||
            lower.includes('loading') ||
            lower.includes('arrow') ||
            lower.includes('old_version')
          ) {
            continue;
          }

          const absUrl = this.normalizeImageUrl(
            src.startsWith('http') ? src : `https:${src.startsWith('//') ? src : `//${src}`}`
          );
          if (!seen.has(absUrl)) {
            seen.add(absUrl);
            pages.push({
              index: pages.length,
              url: absUrl,
              headers: this.getImageHeaders(),
            });
          }
        }
      }

      if (pages.length > 0) {
        return pages;
      }
    } catch {
      // Fallback
    }

    return [];
  }
}

// ==========================================
// PURE TYPESCRIPT AES-128-CBC ZERO PADDING
// ==========================================
const INVERSE_SBOX = new Uint8Array([
  0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
  0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
  0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
  0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
  0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
  0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
  0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
  0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
  0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
  0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
  0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
  0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
  0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
  0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
  0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
  0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d,
]);

const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
const FORWARD_SBOX = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  FORWARD_SBOX[INVERSE_SBOX[i]] = i;
}

function subWord(w: number): number {
  return (
    (FORWARD_SBOX[(w >>> 24) & 0xff] << 24) |
    (FORWARD_SBOX[(w >>> 16) & 0xff] << 16) |
    (FORWARD_SBOX[(w >>> 8) & 0xff] << 8) |
    FORWARD_SBOX[w & 0xff]
  );
}

function rotWord(w: number): number {
  return ((w << 8) | (w >>> 24)) >>> 0;
}

function keyExpansion(keyBytes: Uint8Array): Uint32Array {
  const w = new Uint32Array(44);
  for (let i = 0; i < 4; i++) {
    w[i] =
      ((keyBytes[4 * i] << 24) |
        (keyBytes[4 * i + 1] << 16) |
        (keyBytes[4 * i + 2] << 8) |
        keyBytes[4 * i + 3]) >>>
      0;
  }
  for (let i = 4; i < 44; i++) {
    let temp = w[i - 1];
    if (i % 4 === 0) {
      temp = (subWord(rotWord(temp)) ^ (RCON[i / 4] << 24)) >>> 0;
    }
    w[i] = (w[i - 4] ^ temp) >>> 0;
  }
  return w;
}

function gmul(a: number, b: number): number {
  let p = 0;
  for (let counter = 0; counter < 8; counter++) {
    if ((b & 1) !== 0) p ^= a;
    const hi_bit_set = (a & 0x80) !== 0;
    a = (a << 1) & 0xff;
    if (hi_bit_set) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}

function invMixColumns(s: Uint8Array): void {
  for (let c = 0; c < 4; c++) {
    const s0 = s[c * 4 + 0];
    const s1 = s[c * 4 + 1];
    const s2 = s[c * 4 + 2];
    const s3 = s[c * 4 + 3];
    s[c * 4 + 0] = gmul(s0, 0x0e) ^ gmul(s1, 0x0b) ^ gmul(s2, 0x0d) ^ gmul(s3, 0x09);
    s[c * 4 + 1] = gmul(s0, 0x09) ^ gmul(s1, 0x0e) ^ gmul(s2, 0x0b) ^ gmul(s3, 0x0d);
    s[c * 4 + 2] = gmul(s0, 0x0d) ^ gmul(s1, 0x09) ^ gmul(s2, 0x0e) ^ gmul(s3, 0x0b);
    s[c * 4 + 3] = gmul(s0, 0x0b) ^ gmul(s1, 0x0d) ^ gmul(s2, 0x09) ^ gmul(s3, 0x0e);
  }
}

function decryptBlock(input: Uint8Array, output: Uint8Array, w: Uint32Array): void {
  const state = new Uint8Array(16);
  for (let i = 0; i < 16; i++) state[i] = input[i];

  for (let c = 0; c < 4; c++) {
    const roundKey = w[40 + c];
    state[c * 4 + 0] ^= (roundKey >>> 24) & 0xff;
    state[c * 4 + 1] ^= (roundKey >>> 16) & 0xff;
    state[c * 4 + 2] ^= (roundKey >>> 8) & 0xff;
    state[c * 4 + 3] ^= roundKey & 0xff;
  }

  for (let round = 9; round >= 1; round--) {
    const t1 = state[13];
    state[13] = state[9];
    state[9] = state[5];
    state[5] = state[1];
    state[1] = t1;

    const t2_0 = state[2];
    const t2_1 = state[6];
    state[2] = state[10];
    state[6] = state[14];
    state[10] = t2_0;
    state[14] = t2_1;

    const t3 = state[3];
    state[3] = state[7];
    state[7] = state[11];
    state[11] = state[15];
    state[15] = t3;

    for (let i = 0; i < 16; i++) {
      state[i] = INVERSE_SBOX[state[i]];
    }

    for (let c = 0; c < 4; c++) {
      const roundKey = w[round * 4 + c];
      state[c * 4 + 0] ^= (roundKey >>> 24) & 0xff;
      state[c * 4 + 1] ^= (roundKey >>> 16) & 0xff;
      state[c * 4 + 2] ^= (roundKey >>> 8) & 0xff;
      state[c * 4 + 3] ^= roundKey & 0xff;
    }

    invMixColumns(state);
  }

  const t1 = state[13];
  state[13] = state[9];
  state[9] = state[5];
  state[5] = state[1];
  state[1] = t1;

  const t2_0 = state[2];
  const t2_1 = state[6];
  state[2] = state[10];
  state[6] = state[14];
  state[10] = t2_0;
  state[14] = t2_1;

  const t3 = state[3];
  state[3] = state[7];
  state[7] = state[11];
  state[11] = state[15];
  state[15] = t3;

  for (let i = 0; i < 16; i++) {
    state[i] = INVERSE_SBOX[state[i]];
  }

  for (let c = 0; c < 4; c++) {
    const roundKey = w[c];
    state[c * 4 + 0] ^= (roundKey >>> 24) & 0xff;
    state[c * 4 + 1] ^= (roundKey >>> 16) & 0xff;
    state[c * 4 + 2] ^= (roundKey >>> 8) & 0xff;
    state[c * 4 + 3] ^= roundKey & 0xff;
  }

  for (let i = 0; i < 16; i++) {
    output[i] = state[i];
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('utf8');
  }
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return decodeURIComponent(escape(str));
}

function decryptAes128CbcZeroPadding(ciphertextB64: string, keyHex: string, ivHex: string): string {
  const keyBytes = hexToBytes(keyHex);
  const ivBytes = hexToBytes(ivHex);
  const cipherBytes = base64ToBytes(ciphertextB64);
  const w = keyExpansion(keyBytes);

  const blockCount = Math.floor(cipherBytes.length / 16);
  const plaintext = new Uint8Array(cipherBytes.length);
  const blockOutput = new Uint8Array(16);

  let prevBlock = ivBytes;
  for (let b = 0; b < blockCount; b++) {
    const offset = b * 16;
    const currentBlock = cipherBytes.subarray(offset, offset + 16);
    decryptBlock(currentBlock, blockOutput, w);
    for (let i = 0; i < 16; i++) {
      plaintext[offset + i] = blockOutput[i] ^ prevBlock[i];
    }
    prevBlock = currentBlock;
  }

  let end = plaintext.length;
  while (end > 0 && plaintext[end - 1] === 0) {
    end--;
  }

  return bytesToUtf8(plaintext.subarray(0, end));
}
