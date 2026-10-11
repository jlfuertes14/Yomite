/**
 * Philia Scans Engine Parser
 * Next.js React Server Components scanlation platform with streaming media CDN.
 * Active Domain: https://philiascans.org
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
import { DEFAULT_USER_AGENT } from '../network/httpClient';

const PHILIA_GENRES: string[] = [
  'Action',
  'Adventure',
  'Comedy',
  'Cooking',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Gourmet',
  'Harem',
  'Historical',
  'Horror',
  'Isekai',
  'Josei',
  'Mafia',
  'Magic',
  'Martial Arts',
  'Mature',
  'Monsters',
  'Music',
  'Mystery',
  'Psychological',
  'Regression',
  'Reincarnation',
  'Romance',
  'School Life',
  'Sci-Fi',
  'Seinen',
  'Shoujo',
  'Shounen',
  'Slice of Life',
  'Supernatural',
  'Survival',
  'Thriller',
  'Tragedy',
  'Villainess',
  'War',
];

export class PhiliaScansParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;

  constructor(metadata?: MangaSourceMetadata) {
    super();
    this.metadata = metadata || {
      id: 'philiascans',
      name: 'PhiliaScans',
      domain: 'philiascans.org',
      baseUrl: 'https://philiascans.org',
      locale: 'en',
      isNsfw: false,
      version: '1.1.0',
      description: 'Philia Scans - Read webtoons and manhwa online for free.',
      enabled: true,
      icon: 'https://www.google.com/s2/favicons?domain=philiascans.org&sz=64',
      availableSortOrders: ['popular', 'latest', 'alphabetical', 'rating', 'newest'],
    };
  }

  public override getAvailableSorts(): SourceSortOption[] {
    return [
      { id: 'popular', label: 'Most Popular' },
      { id: 'latest', label: 'Latest Chapters' },
      { id: 'alphabetical', label: 'A to Z' },
      { id: 'rating', label: 'Highest Rated' },
      { id: 'newest', label: 'Recently Added' },
    ];
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: 'https://philiascans.org/',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
  }

  public override async getAvailableTags(): Promise<SourceTag[]> {
    return PHILIA_GENRES.map((g) => ({
      id: g.toLowerCase().replace(/\s+/g, '-'),
      label: g,
      group: 'Genre',
    }));
  }

  private toSeriesUrl(rawUrlOrSlug: string): string {
    if (!rawUrlOrSlug) return '';
    if (rawUrlOrSlug.startsWith('http://') || rawUrlOrSlug.startsWith('https://')) {
      return rawUrlOrSlug;
    }
    const clean = rawUrlOrSlug.replace(/^philiascans:/, '').replace(/^\/+/, '').replace(/\/+$/, '');
    if (clean.startsWith('series/')) {
      return `${this.metadata.baseUrl}/${clean}`;
    }
    return `${this.metadata.baseUrl}/series/${clean}`;
  }

  private toChapterUrl(urlOrToken: string): string {
    if (!urlOrToken) return `${this.metadata.baseUrl}/`;
    if (urlOrToken.startsWith('http://') || urlOrToken.startsWith('https://')) {
      return urlOrToken;
    }
    const clean = urlOrToken
      .replace(/^philiascans:/, '')
      .replace(/^\/+/, '');
    const sanitized = clean.replace(/^read\/series\//, 'series/').replace(/^read\/read\//, 'read/');
    if (sanitized.startsWith('series/') || sanitized.startsWith('read/')) {
      return `${this.metadata.baseUrl}/${sanitized}`;
    }
    // If it's a chapter token or chapter slug
    if (sanitized.includes('chapter-')) {
      return `${this.metadata.baseUrl}/series/${sanitized}`;
    }
    return `${this.metadata.baseUrl}/read/${sanitized}`;
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    const page = filter.page || 1;
    let url: string;

    const selectedTags = filter.tags || filter.includedTags;
    const tagParam =
      selectedTags && selectedTags.length > 0
        ? `&filter_genre[]=${encodeURIComponent(selectedTags[0].toLowerCase().replace(/\s+/g, '-'))}`
        : '';

    let orderParam = 'views';
    if (filter.order === 'latest') orderParam = 'recently-updated';
    else if (filter.order === 'alphabetical') orderParam = 'title';
    else if (filter.order === 'rating') orderParam = 'rating';
    else if (filter.order === 'newest') orderParam = 'added';
    else if (filter.order === 'popular') orderParam = 'views';

    if (filter.query && filter.query.trim().length > 0) {
      const q = encodeURIComponent(filter.query.trim());
      url = `${this.metadata.baseUrl}/all-mangas?s=${q}${tagParam}&m_orderby=${orderParam}&page=${page}`;
    } else if (tagParam) {
      url = `${this.metadata.baseUrl}/all-mangas?m_orderby=${orderParam}&page=${page}${tagParam}`;
    } else {
      url = `${this.metadata.baseUrl}/all-mangas?m_orderby=${orderParam}&page=${page}`;
    }

    const $ = await this.fetchHtml(url);
    const mangaList: SourceManga[] = [];

    // Map Next.js streaming image slots (div[id^="S:"] -> img src)
    const imgMap = new Map<string, string>();
    const hiddenSlots = $.root.querySelectorAll('div[id^="S:"]');
    for (const div of hiddenSlots) {
      const slotId = div.getAttribute('id');
      const img = div.querySelector('img');
      const src = img?.getAttribute('src');
      if (slotId && src) {
        imgMap.set(slotId, src);
      }
    }

    const cards = $('.philia-home-card, article.ph-card, .ph-card, a.manga-card, .manga-card');
    cards.each((_, el) => {
      const card = $(el);
      let rawHref = card.attr('href') || '';
      if (!rawHref || !rawHref.includes('/series/')) {
        const link = card.find('h3 a, a.philia-home-card-cover-link, a[href^="/series/"]').first();
        rawHref = link.attr('href') || '';
      }
      if (!rawHref || !rawHref.includes('/series/')) return;

      const titleEl = card.find('h3, .ph-card-title, .card-title, h4').first();
      let title = this.cleanText(titleEl.text() || card.attr('aria-label') || '');
      if (title.startsWith('Read ') && title.endsWith(' online free')) {
        title = title.replace(/^Read\s+/i, '').replace(/\s+online free$/i, '').trim();
      }

      // Find template ID e.g. "B:2d" -> look up "S:2d" in slot map
      const tpl = card.find('template[id]').first();
      const tplId = tpl.attr('id') || '';
      const sId = tplId ? tplId.replace(/^B:/, 'S:') : '';
      let cover = imgMap.get(sId) || null;

      if (!cover) {
        const directImg = card.find('img').first();
        cover =
          directImg.attr('src') ||
          directImg.attr('data-src') ||
          null;
      }

      const slug = rawHref.replace(/^\/series\//, '').replace(/\/+$/, '');

      mangaList.push({
        id: `${this.metadata.id}:${slug}`,
        sourceId: this.metadata.id,
        title,
        url: rawHref,
        publicUrl: `${this.metadata.baseUrl}${rawHref}`,
        coverUrl: cover ? (cover.startsWith('http') ? cover : `${this.metadata.baseUrl}${cover}`) : null,
        coverHeaders: {
          Referer: 'https://philiascans.org/',
          'User-Agent': DEFAULT_USER_AGENT,
        },
        state: 'ongoing',
      });
    });

    if (filter.order === 'alphabetical') {
      mangaList.sort((a, b) => a.title.localeCompare(b.title));
    }

    return mangaList;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    const fullUrl = this.toSeriesUrl(manga.url || manga.id);
    const $ = await this.fetchHtml(fullUrl);

    // Title
    const titleEl = $('h1, .series-title, h2.font-bold').first();
    let rawTitle = this.cleanText(titleEl.text()) || manga.title;
    if (rawTitle.startsWith('Read ') && rawTitle.endsWith(' online free')) {
      rawTitle = rawTitle.replace(/^Read\s+/i, '').replace(/\s+online free$/i, '').trim();
    }

    // Cover image
    let cover: string | null = null;
    const coverImg = $('img[alt*="cover" i], .series-cover img, .poster img').first();
    cover = coverImg.attr('src') || coverImg.attr('data-src') || null;

    if (!cover) {
      const allImgs = $('img');
      allImgs.each((_, el) => {
        const src = $(el).attr('src') || '';
        if (src.includes('cover') || src.includes('poster') || src.includes('uploads/')) {
          cover = src;
          return false;
        }
      });
    }

    if (!cover) {
      cover = manga.coverUrl;
    }

    // Description / synopsis
    const desc = this.cleanText(
      $('.series-synopsis, .synopsis, .description, .prose p, p.line-clamp-4').first().text()
    );

    // Genres
    const genres: string[] = [];
    $('a[href*="filter_genre[]"]').each((_, el) => {
      const g = this.cleanText($(el).text());
      if (g && !genres.includes(g)) genres.push(g);
    });

    return {
      ...manga,
      title: rawTitle,
      coverUrl: cover ? (cover.startsWith('http') ? cover : `${this.metadata.baseUrl}${cover}`) : null,
      coverHeaders: {
        Referer: 'https://philiascans.org/',
        'User-Agent': DEFAULT_USER_AGENT,
      },
      description: desc || undefined,
      tags: genres.slice(0, 15),
      state: 'ongoing',
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const fullUrl = this.toSeriesUrl(manga.url || manga.id);
    const $ = await this.fetchHtml(fullUrl);
    const chapters: SourceChapter[] = [];
    const seenNumbers = new Set<number>();
    const seenHrefs = new Set<string>();

    // 1. Check structured JSON-LD scripts
    const ldJsonScripts = $.root.querySelectorAll('script[type="application/ld+json"]');
    for (const scriptEl of ldJsonScripts) {
      try {
        const jsonText = scriptEl.text || '';
        if (!jsonText || !jsonText.includes('Chapter')) continue;
        const data = JSON.parse(jsonText);

        // Check hasPart array
        const parts = Array.isArray(data.hasPart) ? data.hasPart : [];
        for (const item of parts) {
          const itemUrl = item.url || item['@id'] || '';
          const itemName = item.name || '';
          if (!itemUrl) continue;

          let num = 0;
          const numMatch = itemName.match(/(?:chapter|ch\.?)\s*([\d.]+)/i) || itemUrl.match(/chapter-(\d+(?:\.\d+)?)/i);
          if (numMatch) num = parseFloat(numMatch[1]);
          if (num > 0 && seenNumbers.has(num)) continue;
          if (seenHrefs.has(itemUrl)) continue;

          if (num > 0) seenNumbers.add(num);
          seenHrefs.add(itemUrl);

          const cleanPath = itemUrl.replace(/^https?:\/\/philiascans\.org\/?/i, '').replace(/^\/+/, '');
          chapters.push({
            id: `${this.metadata.id}:${cleanPath}`,
            sourceId: this.metadata.id,
            mangaId: manga.id,
            name: itemName || `Chapter ${num}`,
            number: num,
            url: `/${cleanPath}`,
            dateUpload: item.datePublished ? new Date(item.datePublished).getTime() : undefined,
          });
        }

        // Check itemListElement array
        const listElements = Array.isArray(data.itemListElement) ? data.itemListElement : [];
        for (const el of listElements) {
          const elUrl = el.url || el.item || '';
          const elName = el.name || '';
          if (!elUrl || !elUrl.includes('chapter-')) continue;

          let num = 0;
          const numMatch = elName.match(/(?:chapter|ch\.?)\s*([\d.]+)/i) || elUrl.match(/chapter-(\d+(?:\.\d+)?)/i);
          if (numMatch) num = parseFloat(numMatch[1]);
          if (num > 0 && seenNumbers.has(num)) continue;
          if (seenHrefs.has(elUrl)) continue;

          if (num > 0) seenNumbers.add(num);
          seenHrefs.add(elUrl);

          const cleanPath = elUrl.replace(/^https?:\/\/philiascans\.org\/?/i, '').replace(/^\/+/, '');
          chapters.push({
            id: `${this.metadata.id}:${cleanPath}`,
            sourceId: this.metadata.id,
            mangaId: manga.id,
            name: elName || `Chapter ${num}`,
            number: num,
            url: `/${cleanPath}`,
          });
        }
      } catch {
        // Ignore JSON parse errors for non-chapter scripts
      }
    }

    // 2. Fallback: regex search in raw HTML for Chapter items
    if (chapters.length === 0) {
      const rawHtml = $.html();
      const chapterRegex = /\{"@type":\["Chapter"[^}]*"url":"(https:\/\/philiascans\.org\/series\/[^"]+)","name":"([^"]+)"/g;
      const matches = [...rawHtml.matchAll(chapterRegex)];
      for (const m of matches) {
        const itemUrl = m[1];
        const itemName = m[2];
        let num = 0;
        const numMatch = itemName.match(/(?:chapter|ch\.?)\s*([\d.]+)/i) || itemUrl.match(/chapter-(\d+(?:\.\d+)?)/i);
        if (numMatch) num = parseFloat(numMatch[1]);
        if (num > 0 && seenNumbers.has(num)) continue;
        if (seenHrefs.has(itemUrl)) continue;

        if (num > 0) seenNumbers.add(num);
        seenHrefs.add(itemUrl);

        const cleanPath = itemUrl.replace(/^https?:\/\/philiascans\.org\/?/i, '').replace(/^\/+/, '');
        chapters.push({
          id: `${this.metadata.id}:${cleanPath}`,
          sourceId: this.metadata.id,
          mangaId: manga.id,
          name: itemName || `Chapter ${num}`,
          number: num,
          url: `/${cleanPath}`,
        });
      }
    }

    // 3. Fallback: scan DOM links
    $('a[href*="/read/"], a[href*="/chapter-"]').each((_, el) => {
      const link = $(el);
      const rawHref = link.attr('href') || '';
      if (!rawHref) return;

      const text = this.cleanText(link.text());
      if (/^(read|start reading|start|latest|read chapter)$/i.test(text.trim())) {
        return;
      }

      let num = 0;
      let displayName = text;
      const chMatch = text.match(/(?:chapter|ch\.?)\s*([\d.]+)/i);
      if (chMatch) {
        num = parseFloat(chMatch[1]);
        displayName = `Chapter ${chMatch[1]}`;
      } else {
        const hrefMatch = rawHref.match(/chapter-(\d+(?:\.\d+)?)/i);
        if (hrefMatch) {
          num = parseFloat(hrefMatch[1]);
          displayName = `Chapter ${hrefMatch[1]}`;
        }
      }

      if (num > 0 && seenNumbers.has(num)) {
        return;
      }
      if (seenHrefs.has(rawHref)) {
        return;
      }

      if (num > 0) seenNumbers.add(num);
      seenHrefs.add(rawHref);

      const cleanPath = rawHref.replace(/^https?:\/\/philiascans\.org\/?/i, '').replace(/^\/+/, '');
      const tokenMatch = rawHref.match(/\/read\/([^/?#]+)/);
      const chToken = tokenMatch ? tokenMatch[1] : '';

      const finalUrl = chToken ? `/read/${chToken}` : `/${cleanPath}`;
      const finalId = chToken ? `${this.metadata.id}:${chToken}` : `${this.metadata.id}:${cleanPath}`;

      chapters.push({
        id: finalId,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: displayName,
        number: num,
        url: finalUrl,
      });
    });

    // Sort chapters descending by chapter number
    chapters.sort((a, b) => b.number - a.number);

    return chapters;
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const fullUrl = this.toChapterUrl(chapter.url || chapter.id);
    let $ = await this.fetchHtml(fullUrl);
    let rawHtml = $.html();

    // Check for Next.js App Router NEXT_REDIRECT payload in response
    const redirectMatch = rawHtml.match(/NEXT_REDIRECT;[^;]*;([^;]+);/);
    if (redirectMatch && redirectMatch[1]) {
      const destUrl = redirectMatch[1].startsWith('http')
        ? redirectMatch[1]
        : this.toAbsoluteUrl(redirectMatch[1]);
      $ = await this.fetchHtml(destUrl);
      rawHtml = $.html();
    }

    const pages: SourcePage[] = [];

    // 1. Strict regex for authentic media.philiascans.org CDN URLs with tokens
    const cdnRegex = /https?:\/\/media\.philiascans\.org\/api\/media\/chapters\/[^\s"']+(?=\\"|")/g;
    const matches = [...rawHtml.matchAll(cdnRegex)];
    const uniqueUrls: string[] = [];
    const seen = new Set<string>();

    for (const m of matches) {
      let rawUrl = m[0];
      // Normalize escaped unicode e.g. \u0026 -> &
      rawUrl = rawUrl.replace(/\\u0026/g, '&');
      // Strip trailing backslashes, quotes or semicolons
      const cleanUrl = rawUrl.replace(/\\+$/, '').replace(/[";]+$/, '').trim();

      if (!seen.has(cleanUrl) && cleanUrl.includes('token=')) {
        seen.add(cleanUrl);
        uniqueUrls.push(cleanUrl);
      }
    }

    // 2. Fallback: match any media.philiascans.org URL
    if (uniqueUrls.length === 0) {
      for (const m of matches) {
        let cleanUrl = m[0].replace(/\\u0026/g, '&').replace(/\\+$/, '').replace(/[";]+$/, '').trim();
        if (!seen.has(cleanUrl)) {
          seen.add(cleanUrl);
          uniqueUrls.push(cleanUrl);
        }
      }
    }

    // 3. Fallback: match any general api/media/chapters/ and rewrite to media.philiascans.org
    if (uniqueUrls.length === 0) {
      const generalMatches = [...rawHtml.matchAll(/(https?:\/\/[^\s"'\\]+api\/media\/chapters\/[^\s"'\\]+)/g)];
      for (const gm of generalMatches) {
        let clean = gm[1].replace(/\\u0026/g, '&').replace(/\\+$/, '').replace(/[";]+$/, '').trim();
        if (clean.startsWith('https://philiascans.org/api/media/chapters/')) {
          clean = clean.replace('https://philiascans.org/', 'https://media.philiascans.org/');
        }
        if (!seen.has(clean)) {
          seen.add(clean);
          uniqueUrls.push(clean);
        }
      }
    }

    if (uniqueUrls.length === 0) {
      const lower = rawHtml.toLowerCase();
      if (
        lower.includes('unlock this chapter with coins') ||
        lower.includes('claim=chapter-unlock') ||
        lower.includes('premium-lock') ||
        lower.includes('premium-block')
      ) {
        throw new Error(
          'This chapter is locked on Philia Scans (requires coins / early access). Only free chapters can be read.'
        );
      }
    }

    uniqueUrls.forEach((imgUrl, index) => {
      pages.push({
        index,
        url: imgUrl,
        headers: {
          Referer: 'https://philiascans.org/',
          'User-Agent': DEFAULT_USER_AGENT,
        },
      });
    });

    return pages;
  }
}
