/**
 * Hitomi.La Parser
 * Ported from Kotatsu's site/all/HitomiLaParser.kt
 * Fast binary Nozomi index + galleriesinfo client with zero Cloudflare issues
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

export class HitomiLaParser extends BaseParser {
  public readonly metadata: MangaSourceMetadata;
  private readonly cdnDomain = 'gold-usergeneratedcontent.net';
  private readonly ltnBaseUrl = 'https://ltn.gold-usergeneratedcontent.net';

  private ggB = '1791108001/';
  private ggCases = new Set<number>();
  private ggDefault = 0;
  private lastGgFetch = 0;

  constructor(metadata: MangaSourceMetadata) {
    super();
    this.metadata = metadata;
  }

  public override getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: 'https://hitomi.la/',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
  }

  private async refreshGg(): Promise<void> {
    if (Date.now() - this.lastGgFetch < 120000 && this.ggCases.size > 0) return;
    try {
      const script = await sourceHttpClient.fetchJson<string>(
        `${this.ltnBaseUrl}/gg.js?_=${Date.now()}`,
        {
          sourceId: this.metadata.name,
          referer: 'https://hitomi.la/',
          headers: { Accept: 'application/javascript, text/plain, */*' },
        }
      );
      if (typeof script === 'string') {
        const bMatch = script.match(/b:\s*'([^']+)'/);
        if (bMatch && bMatch[1]) {
          this.ggB = bMatch[1];
        }
        const defMatch = script.match(/var\s+o\s*=\s*(\d+)/);
        if (defMatch && defMatch[1]) {
          this.ggDefault = parseInt(defMatch[1], 10);
        }
        const cases = new Set<number>();
        const caseRegex = /case\s+(\d+):/g;
        let match: RegExpExecArray | null;
        while ((match = caseRegex.exec(script)) !== null) {
          cases.add(parseInt(match[1], 10));
        }
        if (cases.size > 0) {
          this.ggCases = cases;
        }
        this.lastGgFetch = Date.now();
      }
    } catch {
      // Fallback to defaults
    }
  }

  public getGgM(g: number): number {
    return this.ggCases.has(g) ? 1 : this.ggDefault;
  }

  public getThumbnailUrl(hash: string): string | null {
    const m = /(..)(.)$/.exec(hash);
    if (!m) return null;
    const g = parseInt(m[2] + m[1], 16);
    const offset = this.getGgM(g);
    const subDomain = String.fromCharCode(97 + offset) + 'tn';
    return `https://${subDomain}.${this.cdnDomain}/webpbigtn/${m[2]}/${m[1]}/${hash}.webp`;
  }

  public getPageUrl(hash: string): string | null {
    const m = /(..)(.)$/.exec(hash);
    if (!m) return null;
    const g = parseInt(m[2] + m[1], 16);
    const offset = this.getGgM(g);
    const subDomain = 'w' + (1 + offset);
    const s = g.toString(10);
    return `https://${subDomain}.${this.cdnDomain}/${this.ggB}${s}/${hash}.webp`;
  }

  private encodeSearchQueryForUrl(s: string): string {
    return s.replace(/[ /.]/g, (m) => {
      if (m === ' ') return '_';
      if (m === '/') return 'slash';
      if (m === '.') return 'dot';
      return m;
    });
  }

  private async resolveNozomiUrl(query: string): Promise<string | null> {
    const raw = query.trim().toLowerCase();
    if (!raw) return null;
    const clean = raw.replace(/_/g, ' ');

    // 1. Direct namespace prefix: series:naruto, tag:schoolgirl, female:schoolgirl, etc.
    if (clean.includes(':')) {
      let candidateUrl = '';
      if (clean.startsWith('tag:female:') || clean.startsWith('tag:male:')) {
        const parts = clean.split(':');
        const gender = parts[1];
        const val = encodeURIComponent(parts.slice(2).join(':').trim());
        candidateUrl = `${this.ltnBaseUrl}/tag/${gender}:${val}-all.nozomi`;
      } else if (clean.startsWith('female:') || clean.startsWith('male:')) {
        const [gender, ...rest] = clean.split(':');
        const val = encodeURIComponent(rest.join(':').trim());
        candidateUrl = `${this.ltnBaseUrl}/tag/${gender}:${val}-all.nozomi`;
      } else {
        const [namespace, ...rest] = clean.split(':');
        const val = encodeURIComponent(rest.join(':').trim());
        candidateUrl = `${this.ltnBaseUrl}/${namespace}/${val}-all.nozomi`;
      }

      try {
        const buf = await sourceHttpClient.fetchBuffer(candidateUrl, {
          sourceId: this.metadata.name,
          referer: 'https://hitomi.la/',
          headers: { Range: 'bytes=0-3' },
          silent: true,
        });
        if (buf && buf.byteLength >= 4) return candidateUrl;
      } catch {}
      return null;
    }

    // 2. Query Hitomi's official tagindex prefix tree (1 fast ~80ms request)
    try {
      const chars = clean.split('').map((c) => this.encodeSearchQueryForUrl(c));
      const tagIndexUrl = `https://tagindex.hitomi.la/global/${chars.join('/')}.json`;
      const suggestions = await sourceHttpClient.fetchJson<any[]>(tagIndexUrl, {
        sourceId: this.metadata.name,
        referer: 'https://hitomi.la/',
        silent: true,
      });

      if (Array.isArray(suggestions) && suggestions.length > 0) {
        for (const item of suggestions) {
          const tagName = item[0];
          const ns = item[2]; // 'female' | 'male' | 'series' | 'character' | 'artist' | 'group' | 'tag'
          if (tagName && ns) {
            const encTag = encodeURIComponent(tagName);
            const url =
              ns === 'female' || ns === 'male'
                ? `${this.ltnBaseUrl}/tag/${ns}:${encTag}-all.nozomi`
                : `${this.ltnBaseUrl}/${ns}/${encTag}-all.nozomi`;
            try {
              const buf = await sourceHttpClient.fetchBuffer(url, {
                sourceId: this.metadata.name,
                referer: 'https://hitomi.la/',
                headers: { Range: 'bytes=0-3' },
                silent: true,
              });
              if (buf && buf.byteLength >= 4) return url;
            } catch {}
          }
        }
      }
    } catch {
      // Fall through to candidate probing
    }

    // 3. Fallback: probe candidate Nozomi files silently
    const encoded = encodeURIComponent(clean);
    const candidates = [
      `${this.ltnBaseUrl}/series/${encoded}-all.nozomi`,
      `${this.ltnBaseUrl}/character/${encoded}-all.nozomi`,
      `${this.ltnBaseUrl}/tag/female:${encoded}-all.nozomi`,
      `${this.ltnBaseUrl}/tag/${encoded}-all.nozomi`,
      `${this.ltnBaseUrl}/artist/${encoded}-all.nozomi`,
      `${this.ltnBaseUrl}/group/${encoded}-all.nozomi`,
      `${this.ltnBaseUrl}/tag/male:${encoded}-all.nozomi`,
    ];

    const checks = candidates.map(async (url) => {
      try {
        const buf = await sourceHttpClient.fetchBuffer(url, {
          sourceId: this.metadata.name,
          referer: 'https://hitomi.la/',
          headers: { Range: 'bytes=0-3' },
          silent: true,
        });
        if (buf && buf.byteLength >= 4) return url;
      } catch {}
      return null;
    });

    const results = await Promise.all(checks);
    return results.find((u) => u !== null) || null;
  }

  private async fetchGallery(id: number): Promise<SourceManga | null> {
    const url = `${this.ltnBaseUrl}/galleries/${id}.js`;
    try {
      const resText = await sourceHttpClient.fetchJson<string>(url, {
        sourceId: this.metadata.name,
        referer: 'https://hitomi.la/',
        headers: { Accept: 'application/javascript, */*' },
        silent: true,
      });

      if (typeof resText !== 'string') return null;

      const jsonStr = resText.replace(/^var\s+galleryinfo\s*=\s*/, '').replace(/;\s*$/, '');
      const data = JSON.parse(jsonStr);

      let coverUrl: string | null = null;
      if (Array.isArray(data.files) && data.files.length > 0) {
        const firstHash = data.files[0].hash;
        if (firstHash) {
          coverUrl = this.getThumbnailUrl(firstHash);
        }
      }

      const tags: string[] = [];
      if (Array.isArray(data.tags)) {
        for (const t of data.tags) {
          const name = typeof t === 'string' ? t : t?.tag;
          if (name) tags.push(name);
        }
      }

      const authors: string[] = [];
      if (Array.isArray(data.artists)) {
        for (const a of data.artists) {
          const name = typeof a === 'string' ? a : a?.artist;
          if (name) authors.push(name);
        }
      }

      const series: string[] = [];
      if (Array.isArray(data.parodys)) {
        for (const p of data.parodys) {
          const name = typeof p === 'string' ? p : p?.parody;
          if (name) series.push(name);
        }
      }

      const characters: string[] = [];
      if (Array.isArray(data.characters)) {
        for (const c of data.characters) {
          const name = typeof c === 'string' ? c : c?.character;
          if (name) characters.push(name);
        }
      }

      const descParts: string[] = [];
      if (series.length) descParts.push(`Series: ${series.join(', ')}`);
      if (characters.length) descParts.push(`Characters: ${characters.join(', ')}`);
      if (data.language) descParts.push(`Language: ${data.language}`);
      if (data.type) descParts.push(`Type: ${data.type}`);
      if (data.files?.length) descParts.push(`Pages: ${data.files.length}`);

      return {
        id: `${this.metadata.id}:${id}`,
        sourceId: this.metadata.id,
        title: this.cleanText(data.title || `Gallery #${id}`),
        url: `/doujinshi/${id}`,
        publicUrl: `https://hitomi.la/doujinshi/${id}.html`,
        coverUrl,
        coverHeaders: { Referer: 'https://hitomi.la/' },
        tags: tags.slice(0, 15),
        authors: authors.length ? authors : undefined,
        description: descParts.length ? descParts.join(' · ') : undefined,
        state: 'completed' as const,
      };
    } catch {
      return null;
    }
  }

  private toDataView(bufferOrView: any): DataView {
    if (bufferOrView instanceof DataView) return bufferOrView;
    if (bufferOrView instanceof ArrayBuffer) return new DataView(bufferOrView);
    if (ArrayBuffer.isView(bufferOrView)) {
      return new DataView(bufferOrView.buffer, bufferOrView.byteOffset, bufferOrView.byteLength);
    }
    const u8 = new Uint8Array(bufferOrView);
    return new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  }

  public async getList(filter: SourceFilter): Promise<SourceManga[]> {
    await this.refreshGg();
    const page = filter.page || 1;
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    const query = filter.query?.trim() || (filter.tags && filter.tags.length > 0 ? filter.tags[0] : '');

    let nozomiUrl: string | null = null;
    if (query) {
      nozomiUrl = await this.resolveNozomiUrl(query);
      if (!nozomiUrl) {
        // Query did not match any tag, series, character, or artist
        return [];
      }
    } else if (filter.order === 'popular') {
      nozomiUrl = `${this.ltnBaseUrl}/popular/today-all.nozomi`;
    } else {
      nozomiUrl = `${this.ltnBaseUrl}/index-all.nozomi`;
    }

    const startByte = offset * 4;
    const endByte = (offset + pageSize) * 4 - 1;
    const ids: number[] = [];

    try {
      const buffer = await sourceHttpClient.fetchBuffer(nozomiUrl, {
        sourceId: this.metadata.name,
        referer: 'https://hitomi.la/',
        headers: {
          Range: `bytes=${startByte}-${endByte}`,
        },
      });

      const view = this.toDataView(buffer);
      for (let i = 0; i < buffer.byteLength; i += 4) {
        if (i + 4 <= buffer.byteLength) {
          ids.push(view.getInt32(i, false));
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch Nozomi index from ${nozomiUrl}:`, err);
    }

    if (ids.length === 0) return [];

    // Fetch gallery info in parallel
    const results = await Promise.allSettled(ids.map((id) => this.fetchGallery(id)));
    const mangas: SourceManga[] = [];

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        mangas.push(res.value);
      }
    }

    return mangas;
  }

  public async getDetails(manga: SourceManga): Promise<SourceManga> {
    await this.refreshGg();
    const idStr = this.extractId(manga.url || manga.id);
    if (!idStr) return manga;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return manga;

    const details = await this.fetchGallery(id);
    if (!details) return manga;

    return {
      ...manga,
      title: details.title || manga.title,
      coverUrl: details.coverUrl || manga.coverUrl,
      coverHeaders: details.coverHeaders || manga.coverHeaders,
      tags: details.tags?.length ? details.tags : manga.tags,
      authors: details.authors?.length ? details.authors : manga.authors,
      description: details.description || manga.description,
      state: 'completed',
    };
  }

  public async getChapters(manga: SourceManga): Promise<SourceChapter[]> {
    const id = this.extractId(manga.url || manga.id);
    return [
      {
        id: `${this.metadata.id}:${id}`,
        sourceId: this.metadata.id,
        mangaId: manga.id,
        name: manga.title,
        number: 1,
        url: `/doujinshi/${id}`,
        dateUpload: Date.now(),
      },
    ];
  }

  public async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const id = this.extractId(chapter.url || chapter.id);
    if (!id) return [];

    await this.refreshGg();

    const url = `${this.ltnBaseUrl}/galleries/${id}.js`;
    const resText = await sourceHttpClient.fetchJson<string>(url, {
      sourceId: this.metadata.name,
      referer: 'https://hitomi.la/',
    });

    const jsonStr = resText.replace(/^var\s+galleryinfo\s*=\s*/, '').replace(/;\s*$/, '');
    const data = JSON.parse(jsonStr);

    if (!Array.isArray(data.files)) return [];

    return data.files.map((file: any, idx: number) => {
      const hash = file.hash;
      const imgUrl = this.getPageUrl(hash) || `https://a2.${this.cdnDomain}/${this.ggB}${this.ggDefault}/${hash}.webp`;

      return {
        index: idx,
        url: imgUrl,
        headers: this.getRequestHeaders(),
      };
    });
  }

  private extractId(str: string): string {
    const match = str.match(/(\d+)/);
    return match ? match[1] : str.replace(/[^\d]/g, '');
  }
}
