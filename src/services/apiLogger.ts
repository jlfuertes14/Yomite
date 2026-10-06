/**
 * Developer Terminal Logger Service & Rate Limit Tracker
 * Formats and outputs MangaDex API & Supabase Sync requests, status codes,
 * response times, and rate-limiting metrics directly to the IDE / Terminal console.
 */

export interface ApiLogEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status: number | null;
  statusText?: string;
  durationMs: number;
  error?: string;
  rateLimit?: {
    limit?: number;
    remaining?: number;
    retryAfter?: number;
  };
}

class ApiLoggerService {
  private logs: ApiLogEntry[] = [];
  private maxLogs = 100;

  public logRequest(entry: Omit<ApiLogEntry, 'id'>): ApiLogEntry {
    const fullEntry: ApiLogEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
    };

    this.logs.unshift(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Print developer log directly to IDE / Terminal console
    this.printTerminalLog(fullEntry);

    return fullEntry;
  }

  public logSupabase(
    action: string,
    details: string,
    durationMs: number,
    error?: string
  ) {
    const isError = !!error;
    const path = `[Supabase] ${action}`;

    const entry: ApiLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      method: 'SUPABASE',
      url: path,
      status: isError ? 400 : 200,
      durationMs,
      error,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    if (isError) {
      console.error(
        `\n❌ [Supabase Sync ERROR] ${action} (${durationMs}ms) | ${details} | Error: ${error}`
      );
    } else {
      console.log(
        `☁️ [Supabase Sync] ${action} (${durationMs}ms) ➔ ${details}`
      );
    }
  }

  private printTerminalLog(entry: ApiLogEntry) {
    const isError = entry.status === null || entry.status === 429 || entry.status >= 400;
    const isRateLimit = entry.status === 429;
    const path = this.formatUrl(entry.url);
    const duration = `${entry.durationMs}ms`;

    let quotaInfo = '';
    if (entry.rateLimit?.remaining !== undefined) {
      quotaInfo = ` [Quota: ${entry.rateLimit.remaining}/${entry.rateLimit.limit ?? 60}]`;
    }

    let sourceLabel = 'MangaDex API';
    if (entry.method.startsWith('SCRAPE:')) {
      const sourceName = entry.method.replace('SCRAPE:', '');
      sourceLabel = `Source Scraper: ${sourceName}`;
    } else if (entry.method.startsWith('GET_JSON:')) {
      const sourceName = entry.method.replace('GET_JSON:', '');
      sourceLabel = `Source API: ${sourceName}`;
    } else if (entry.method.startsWith('GET_BIN:')) {
      const sourceName = entry.method.replace('GET_BIN:', '');
      sourceLabel = `Source Binary: ${sourceName}`;
    } else if (entry.method.startsWith('POST_FORM:')) {
      const sourceName = entry.method.replace('POST_FORM:', '');
      sourceLabel = `Source API: ${sourceName}`;
    } else if (entry.method === 'MANGA_DETAILS' || entry.method === 'MANGA_CHAPTERS') {
      sourceLabel = 'Source Adapter';
    }

    if (isRateLimit) {
      const retryAfter = entry.rateLimit?.retryAfter ?? 5;
      console.warn(
        `\n⛔ [${sourceLabel}] RATE LIMITED (429) | ${entry.method} ${path} (${duration}) | Retry-After: ${retryAfter}s${quotaInfo}`
      );
    } else if (isError) {
      console.error(
        `\n❌ [${sourceLabel} ERROR] ${entry.method} ${path} | Status: ${entry.status ?? 'NET_ERR'} | ${entry.error || 'Failed'}`
      );
    } else {
      console.log(
        `[${sourceLabel}] ${entry.method} ${path} ➔ ${entry.status} OK (${duration})${quotaInfo}`
      );
    }
  }

  private formatUrl(url: string): string {
    try {
      if (url.startsWith('http')) {
        const parsed = new URL(url);
        return parsed.pathname + parsed.search;
      }
      return url;
    } catch {
      return url;
    }
  }

  public getLogs(): ApiLogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
  }
}

export const ApiLogger = new ApiLoggerService();
