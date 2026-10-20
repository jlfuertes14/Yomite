import { CloudFlareError, CloudFlareStatus } from '../network/cloudflare';
import { loadHtml, ParsedHtml } from '../network/htmlParser';
import { DEFAULT_USER_AGENT, sourceHttpClient } from '../network/httpClient';
import {
  MangaSourceMetadata,
  MangaState,
  SourceChapter,
  SourceFilter,
  SourceManga,
  SourcePage,
  SourceSortOption,
} from '../types';
import { BaseParser } from './BaseParser';

const PAGE_SIZE = 15;
const SEARCH_LIMIT = 20;

function findMatching(text: string, start: number, open: string, close: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractRsc(html: string): string {
  const marker = 'self.__next_f.push(';
  const chunks: string[] = [];
  let cursor = 0;
  while (true) {
    const start = html.indexOf(marker, cursor);
    if (start < 0) break;
    const argStart = start + marker.length;
    const argEnd = findMatching(html, argStart - 1, '(', ')');
    if (argEnd < 0) break;
    const arg = html.slice(argStart, argEnd);
    cursor = argEnd + 1;
    try {
      const parsed = JSON.parse(arg);
      if (Array.isArray(parsed) && typeof parsed[1] === 'string') {
        chunks.push(parsed[1]);
      }
    } catch {
      continue;
    }
  }
  return chunks.join('');
}

function isImageUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^https?:\/\//i.test(value) &&
    /\.(?:jpe?g|png|webp|avif|gif)(?:[?#].*)?$/i.test(value)
  );
}

function parseJsonAt(text: string, start: number): any {
  if (start < 0 || start >= text.length) return null;
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  const end = findMatching(text, start, open, close);
  if (end < 0) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function walk(value: any, visitor: (value: any) => void): void {
  visitor(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) walk(item, visitor);
  }
}

function chapterSlugFrom(value: any): string {
  if (!value || typeof value !== 'object') return '';
  const direct = value.n51tcf9 || value.chapter_slug;
  if (typeof direct === 'string') return direct;
  for (const item of Object.values(value)) {
    if (typeof item === 'string' && /(?:^|-)chapter-\d+(?:\.\d+)?$/.test(item)) {
      return item;
    }
  }
  return '';
}

function isChapterObject(value: any): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (typeof value.created_at !== 'string') return false;
  if (value.index === undefined && !value.e5dij9p && !value.chapter_name) return false;
  return Boolean(chapterSlugFrom(value));
}

function extractReaderImages(rsc: string): string[] {
  const layoutMatch = rsc.match(
    /"([^"]+)"\s*:\s*(\[(?:"[^"]*"\s*,?\s*)+)\]\s*,\s*"layoutHints"/
  );
  if (layoutMatch) {
    try {
      const parsed = JSON.parse(layoutMatch[2]);
      if (Array.isArray(parsed) && parsed.length && parsed.every(isImageUrl)) {
        return parsed;
      }
    } catch { }
  }

  let withLayout: string[] = [];
  let rscJson: any = null;
  try {
    rscJson = JSON.parse(`[${rsc.replace(/\n/g, '')}]`);
  } catch {
    rscJson = null;
  }
  if (rscJson) {
    walk(rscJson, (value) => {
      if (withLayout.length) return;
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      if (!Array.isArray(value.layoutHints)) return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'layoutHints' || !Array.isArray(child) || child.length === 0) continue;
        if (child.every(isImageUrl)) {
          withLayout = child as string[];
          return;
        }
      }
    });
  }
  if (withLayout.length) return withLayout;

  const candidates = new Map<string, string[]>();
  const arrayRegex = /\[(?:"https?:\/\/[^"]+",?\s*)+\]/g;
  let match: RegExpExecArray | null;
  while ((match = arrayRegex.exec(rsc))) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length && parsed.every(isImageUrl)) {
        candidates.set(match[0], parsed);
      }
    } catch {
      continue;
    }
  }
  const pageLike = Array.from(candidates.values())
    .filter((items) =>
      items.some(
        (url) =>
          /\/uploads\/(series|chapters)\//.test(url) ||
          /akira\.templetoons\.com/i.test(url)
      )
    )
    .sort((a, b) => b.length - a.length);
  return pageLike[0] || [];
}

export class TempleScansParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  private pageCache = new Map<string, { html: string; parsed: ParsedHtml; expires: number }>();
  private listCache: { items: any[]; expires: number } | null = null;

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: this.metadata.baseUrl,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };
  }

  public override getImageHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: `${this.metadata.baseUrl}/`,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'latest', label: 'Latest Update' },
      { id: 'popular', label: 'Most Views' },
      { id: 'newest', label: 'Newest' },
      { id: 'alphabetical', label: 'A-Z' },
    ];
  }

  public resolveUrl(url: string): { type: 'manga' | 'chapter'; id: string } | null {
    if (!url || !url.includes('templetoons.com')) return null;
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] !== 'comic' || !parts[1]) return null;
      if (parts[2]) {
        return {
          type: 'chapter',
          id: `${this.metadata.id}:${parts[1]}:${parts[2]}`,
        };
      }
      return { type: 'manga', id: `${this.metadata.id}:${parts[1]}` };
    } catch {
      return null;
    }
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const query = filter.query?.trim() || '';
    const page = Math.max(1, filter.page || 1);

    if (query) {
      if (query.length < 2) return [];
      const url = `${this.metadata.baseUrl}/api/search?q=${encodeURIComponent(
        query
      )}&page=${page}&limit=${SEARCH_LIMIT}`;
      const response = await sourceHttpClient.fetchJson<any>(url, {
        sourceId: this.metadata.name,
        referer: this.metadata.baseUrl,
      });
      const items = Array.isArray(response?.projects) ? response.projects : [];
      return this.sortItems(items, filter.order).map((item) => this.mapSeries(item));
    }

    let allItems: any[] = [];
    if (this.listCache && this.listCache.expires > Date.now()) {
      allItems = this.listCache.items;
    }

    if (!allItems.length) {
      const { html, parsed } = await this.fetchPage('/comics');
      allItems = this.readSeriesList(extractRsc(html));
      if (!allItems.length) {
        return this.readDomCards(parsed);
      }
      this.listCache = { items: allItems, expires: Date.now() + 5 * 60 * 1000 };
    }

    const filtered = this.filterByState(allItems, filter.state);
    const sorted = this.sortItems(filtered, filter.order);
    const maxPage = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    if (page > maxPage) return [];

    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE).map((item) => this.mapSeries(item));
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const slug = this.getSlug(manga);
    if (!slug) return manga;

    const { html, parsed } = await this.fetchPage(`/comic/${slug}`);
    const ld = this.readJsonLd(parsed);
    const title =
      this.cleanText(ld?.name) ||
      this.cleanText(parsed('#series-title').first().text()) ||
      manga.title;

    const synopsis = parsed('#series-synopsis-text').first().text();
    const description = this.stripHtml(synopsis) || this.cleanText(ld?.description) || manga.description;

    const authors = this.readAuthors(ld, parsed);
    const altTitles = this.readAltTitles(ld, parsed, title);
    const genres = this.readGenres(ld, parsed);
    const stats = this.readStats(parsed);
    const chapters = this.readDomChapters(parsed, slug, manga.id);
    const lastChapterDate = chapters.reduce(
      (max, chapter) => Math.max(max, chapter.dateUpload || 0),
      0
    );
    const relativeUpdate = this.parseDate(stats.updated || '');

    const ldImage = typeof ld?.image === 'string' ? ld.image : ld?.image?.url;
    const coverUrl =
      this.cleanText(ldImage) ||
      parsed('meta[property="og:image"]').attr('content') ||
      manga.coverUrl;

    const isAdult =
      genres.some((genre) => /\+18|18\+|adult/i.test(genre)) ||
      /\+18|18\+|adult/i.test(stats.badge || '');

    return {
      ...manga,
      title,
      url: `/comic/${slug}`,
      publicUrl: `${this.metadata.baseUrl}/comic/${slug}`,
      altTitles: altTitles.length ? altTitles : manga.altTitles,
      coverUrl: coverUrl || manga.coverUrl,
      coverHeaders: this.getImageHeaders(),
      authors: authors.length ? authors : manga.authors,
      description: description || manga.description,
      tags: genres.length ? genres.filter((genre) => !/\+18|18\+|adult/i.test(genre)) : manga.tags,
      state: stats.state || manga.state,
      contentRating: isAdult ? 'adult' : manga.contentRating,
      chaptersCount: stats.chaptersCount || chapters.length || manga.chaptersCount,
      lastUpdated: lastChapterDate || relativeUpdate || manga.lastUpdated,
      locale: manga.locale || this.metadata.locale,
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const slug = this.getSlug(manga);
    if (!slug) return [];

    const { html, parsed } = await this.fetchPage(`/comic/${slug}`);
    const rscChapters = this.readRscChapters(extractRsc(html), slug, manga.id);
    const domChapters = this.readDomChapters(parsed, slug, manga.id);

    const merged = new Map<string, SourceChapter>();
    for (const chapter of domChapters) {
      merged.set(this.chapterKey(chapter), chapter);
    }
    for (const chapter of rscChapters) {
      const key = this.chapterKey(chapter);
      if (!merged.has(key)) merged.set(key, chapter);
    }

    return Array.from(merged.values()).sort((a, b) => {
      if (b.number !== a.number) return b.number - a.number;
      return (b.dateUpload || 0) - (a.dateUpload || 0);
    });
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const url = this.toAbsoluteUrl(chapter.url);
    const { html } = await this.fetchPage(url);
    const rsc = extractRsc(html);
    let images = extractReaderImages(rsc);

    if (!images.length) {
      const parsed = loadHtml(html);
      const domImages = parsed('.protected-content img, img[src*="/uploads/"]')
        .map((_, element) => element.attr('src') || '')
        .map((src) => this.toAbsoluteUrl(src))
        .filter(isImageUrl);
      images = Array.from(new Set(domImages));
    }

    return images.map((image, index) => ({
      index,
      url: image,
      headers: this.getImageHeaders(),
    }));
  }

  private async fetchPage(pathOrUrl: string): Promise<{ html: string; parsed: ParsedHtml }> {
    const url = this.toAbsoluteUrl(pathOrUrl);
    const cached = this.pageCache.get(url);
    if (cached && cached.expires > Date.now()) {
      return { html: cached.html, parsed: cached.parsed };
    }

    const parsed = await this.fetchHtml(url);
    const html = parsed.html();
    this.assertNotChallenge(html, url);

    const entry = { html, parsed, expires: Date.now() + 5 * 60 * 1000 };
    this.pageCache.set(url, entry);
    if (this.pageCache.size > 6) {
      const oldest = this.pageCache.keys().next().value;
      if (oldest) this.pageCache.delete(oldest);
    }
    return { html, parsed };
  }

  private assertNotChallenge(html: string, url: string): void {
    if (
      html.includes('/challenge/page-') ||
      html.toLowerCase().includes('templetoons uses cloudflare turnstile')
    ) {
      throw new CloudFlareError(
        `[${this.metadata.name}] Cloudflare verification challenge detected at ${url}.`,
        this.metadata.name,
        url,
        this.metadata.domain,
        CloudFlareStatus.CAPTCHA_CHALLENGE
      );
    }
  }

  private getSlug(manga: SourceManga): string {
    const fromUrl = manga.url?.match(/\/comic\/([^/?#]+)/)?.[1];
    if (fromUrl) return fromUrl;
    return (manga.id || '').replace(new RegExp(`^${this.metadata.id}:`), '').split(':')[0];
  }

  private readSeriesList(rsc: string): any[] {
    const marker = /"list"\s*:\s*\[/g;
    let match: RegExpExecArray | null;
    while ((match = marker.exec(rsc))) {
      const start = rsc.indexOf('[', match.index);
      const value = parseJsonAt(rsc, start);
      if (Array.isArray(value) && value.length) {
        const valid = value.filter(
          (item) =>
            item &&
            typeof item === 'object' &&
            typeof item.xxaep8w === 'string' &&
            typeof item.j2yyqlv === 'string'
        );
        if (valid.length) return valid;
      }
    }
    return [];
  }

  private readDomCards(parsed: ParsedHtml): SourceManga[] {
    const results: SourceManga[] = [];
    parsed('a[href^="/comic/"]').each((_, anchor) => {
      const href = anchor.attr('href') || '';
      const parts = href.split('/').filter(Boolean);
      if (parts.length !== 2) return;
      const img = anchor.find('img').first();
      const heading = anchor.find('h2').first();
      const title = this.cleanText(heading.text()) || this.cleanText(img.attr('alt'));
      if (!title) return;
      const slug = parts[1];
      results.push({
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        url: `/comic/${slug}`,
        publicUrl: `${this.metadata.baseUrl}/comic/${slug}`,
        title,
        coverUrl: this.toAbsoluteUrl(img.attr('src') || '') || null,
        coverHeaders: this.getImageHeaders(),
        contentRating: /\+18|18\+|adult/i.test(anchor.text()) ? 'adult' : undefined,
        locale: this.metadata.locale,
      });
    });
    const seen = new Set<string>();
    return results.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  private filterByState(items: any[], state?: string): any[] {
    if (state === 'unknown') return items;
    const labels = this.stateLabels(state);
    return items.filter((item) => labels.includes(String(item.status || '').toLowerCase()));
  }

  private stateLabels(state?: string): string[] {
    switch (state) {
      case 'completed':
        return ['completed'];
      case 'hiatus':
      case 'paused':
        return ['hiatus', 'season break'];
      case 'cancelled':
        return ['cancelled', 'canceled', 'dropped'];
      case 'abandoned':
        return ['dropped', 'cancelled', 'canceled'];
      case 'ongoing':
        return ['ongoing'];
      default:
        return ['ongoing'];
    }
  }

  private sortItems(items: any[], order?: string): any[] {
    const sorted = [...items];
    if (order === 'alphabetical') {
      sorted.sort((a, b) =>
        String(a.title || a.j2yyqlv || '').localeCompare(String(b.title || b.j2yyqlv || ''))
      );
      return sorted;
    }

    const key =
      order === 'popular'
        ? 'total_views'
        : order === 'newest'
          ? 'created_at'
          : 'update_chapter';

    sorted.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (key === 'total_views') return Number(bv || 0) - Number(av || 0);
      return new Date(bv || 0).getTime() - new Date(av || 0).getTime();
    });
    return sorted;
  }

  private mapSeries(item: any): SourceManga {
    const slug = item.series_slug || item.slug || item.xxaep8w || '';
    const title = this.cleanText(item.title || item.j2yyqlv) || slug;
    const badge = this.cleanText(item.badge);
    const altTitles = this.splitAltTitles(item.alternative_names);
    const updated = item.update_chapter || item.created_at;

    return {
      id: `${this.metadata.id}:${slug}`,
      sourceId: this.metadata.id,
      url: `/comic/${slug}`,
      publicUrl: `${this.metadata.baseUrl}/comic/${slug}`,
      title,
      altTitles: altTitles.length ? altTitles : undefined,
      coverUrl: item.thumbnail ? this.toAbsoluteUrl(item.thumbnail) : null,
      coverHeaders: this.getImageHeaders(),
      state: this.mapState(item.status),
      contentRating: /\+18|18\+|adult/i.test(badge) ? 'adult' : undefined,
      lastUpdated: updated ? Date.parse(updated) || undefined : undefined,
      locale: this.metadata.locale,
    };
  }

  private mapState(status: any): MangaState {
    switch (String(status || '').toLowerCase()) {
      case 'ongoing':
        return 'ongoing';
      case 'completed':
        return 'completed';
      case 'hiatus':
      case 'season break':
        return 'hiatus';
      case 'cancelled':
      case 'canceled':
      case 'dropped':
        return 'cancelled';
      default:
        return 'unknown';
    }
  }

  private readJsonLd(parsed: ParsedHtml): any {
    let result: any = null;
    parsed('script[type="application/ld+json"]').each((_, node) => {
      try {
        const parsedJson = JSON.parse(node.text());
        const values = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
        for (const value of values) {
          const type = value?.['@type'];
          if (
            type === 'ComicSeries' ||
            (Array.isArray(type) && type.includes('ComicSeries'))
          ) {
            result = value;
          }
        }
      } catch {
        return;
      }
    });
    return result;
  }

  private readAuthors(ld: any, parsed: ParsedHtml): string[] {
    const authors: string[] = [];
    const add = (value: any) => {
      const text = this.cleanText(value);
      if (text) authors.push(text);
    };

    if (Array.isArray(ld?.author)) {
      for (const author of ld.author) add(author?.name || author);
    } else if (ld?.author) {
      const value = ld.author.name || ld.author;
      if (typeof value === 'string') {
        for (const part of value.split(',')) add(part);
      } else {
        add(value);
      }
    }

    if (!authors.length) {
      parsed('dl dt').each((_, dt) => {
        if (!/^author/i.test(this.cleanText(dt.text()))) return;
        const dd = dt.raw?.nextElementSibling as any;
        const value = this.cleanText(dd?.textContent || '');
        for (const part of value.split(',')) add(part);
      });
    }

    return Array.from(new Set(authors));
  }

  private readAltTitles(ld: any, parsed: ParsedHtml, title: string): string[] {
    const values: string[] = [];
    const add = (value: any) => {
      const text = this.cleanText(value);
      if (text && text.toLowerCase() !== title.toLowerCase()) values.push(text);
    };

    if (Array.isArray(ld?.alternateName)) {
      for (const name of ld.alternateName) add(name);
    } else {
      add(ld?.alternateName);
    }

    if (!values.length) {
      parsed('dl dt').each((_, dt) => {
        if (!/also known as/i.test(this.cleanText(dt.text()))) return;
        const dd = dt.raw?.nextElementSibling as any;
        const text = this.cleanText(dd?.textContent || '');
        for (const part of text.split(/[;|]/)) add(part);
      });
    }

    return Array.from(new Set(values));
  }

  private splitAltTitles(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.cleanText(item)).filter(Boolean);
    }
    const text = this.cleanText(value);
    if (!text) return [];
    return text.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
  }

  private readGenres(ld: any, parsed: ParsedHtml): string[] {
    const genres: string[] = [];
    parsed('ul[aria-label="Genres"] li').each((_, element) => {
      const text = this.cleanText(element.text());
      if (text) genres.push(text);
    });

    if (!genres.length) {
      const value = ld?.genre;
      if (Array.isArray(value)) {
        for (const genre of value) genres.push(this.cleanText(genre));
      } else if (value) {
        genres.push(this.cleanText(value));
      }
    }

    return Array.from(new Set(genres.filter(Boolean)));
  }

  private readStats(parsed: ParsedHtml): {
    state?: MangaState;
    chaptersCount?: number;
    updated?: string;
    badge?: string;
  } {
    const result: { state?: MangaState; chaptersCount?: number; updated?: string; badge?: string } = {};
    parsed('ul[aria-label="Series stats"] li').each((_, element) => {
      const text = this.cleanText(element.text());
      const countMatch = text.match(/^([\d,.]+)\s+chapters?/i);
      if (countMatch) {
        result.chaptersCount = parseInt(countMatch[1].replace(/[,.]/g, ''), 10);
        return;
      }
      if (/^(ongoing|completed|hiatus|cancelled|canceled|dropped|season break)$/i.test(text)) {
        result.state = this.mapState(text);
        return;
      }
      if (/^updated\s+/i.test(text)) {
        result.updated = text.replace(/^updated\s+/i, '');
      }
    });
    const badges = parsed('span')
      .map((_, element) => this.cleanText(element.text()))
      .filter((text) => /\+18|18\+|adult/i.test(text));
    result.badge = badges[0];
    return result;
  }

  private readRscChapters(rsc: string, slug: string, mangaId: string): SourceChapter[] {
    const marker = /"seriesData"\s*:\s*\{/g;
    let match: RegExpExecArray | null;
    while ((match = marker.exec(rsc))) {
      const start = rsc.indexOf('{', match.index);
      const data = parseJsonAt(rsc, start);
      if (!data) continue;
      let matchesSlug = false;
      walk(data, (value) => {
        if (value?.xxaep8w === slug) matchesSlug = true;
      });
      if (!matchesSlug) continue;

      const chapters: any[] = [];
      walk(data, (value) => {
        if (isChapterObject(value)) chapters.push(value);
      });
      return this.mapRscChapters(chapters, slug, mangaId);
    }
    return [];
  }

  private mapRscChapters(chapters: any[], slug: string, mangaId: string): SourceChapter[] {
    const found = new Map<string, SourceChapter>();
    for (const chapter of chapters) {
      const chapterSlug = chapterSlugFrom(chapter);
      if (!chapterSlug || found.has(chapterSlug)) continue;
      const rawName =
        this.cleanText(chapter.e5dij9p || chapter.chapter_name) ||
        `Chapter ${chapterSlug.match(/(\d+(?:\.\d+)?)$/)?.[1] || ''}`;
      const number =
        this.parseChapterNumber(rawName) ||
        parseFloat(chapterSlug.match(/(\d+(?:\.\d+)?)$/)?.[1] || '0') ||
        0;
      found.set(chapterSlug, {
        id: `${mangaId}:${chapterSlug}`,
        sourceId: this.metadata.id,
        mangaId,
        url: `/comic/${slug}/${chapterSlug}`,
        name: rawName,
        number,
        dateUpload: chapter.created_at ? Date.parse(chapter.created_at) || null : null,
        scanlator: null,
        locale: this.metadata.locale,
      });
    }
    return Array.from(found.values());
  }

  private readDomChapters(parsed: ParsedHtml, slug: string, mangaId: string): SourceChapter[] {
    const chapters: SourceChapter[] = [];
    parsed('a[id^="chapter-link-"]').each((_, anchor) => {
      const href = anchor.attr('href') || '';
      if (!href.includes(`/comic/${slug}/`)) return;
      const chapterSlug = href.split('/').filter(Boolean).pop() || '';
      if (!chapterSlug) return;
      const name =
        this.cleanText(anchor.find('span').first().text()) ||
        this.cleanText(anchor.text());
      const time = anchor.find('time').first().attr('datetime');
      chapters.push({
        id: `${mangaId}:${chapterSlug}`,
        sourceId: this.metadata.id,
        mangaId,
        url: `/comic/${slug}/${chapterSlug}`,
        name: name || `Chapter ${chapterSlug.match(/(\d+(?:\.\d+)?)$/)?.[1] || ''}`,
        number:
          this.parseChapterNumber(name) ||
          parseFloat(chapterSlug.match(/(\d+(?:\.\d+)?)$/)?.[1] || '0') ||
          0,
        dateUpload: time ? Date.parse(time) || null : null,
        scanlator: null,
        locale: this.metadata.locale,
      });
    });
    return chapters;
  }

  private chapterKey(chapter: SourceChapter): string {
    return chapter.url.split('/').filter(Boolean).pop() || chapter.id;
  }
}
