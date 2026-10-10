/**
 * HTTP Client & Web Scraper Engine
 * Provides User-Agent rotation, anti-hotlinking headers, Cheerio HTML parsing,
 * timeout handling, Cloudflare detection, and Cloudflare clearance cookie injection.
 */
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiLogger } from '../../services/apiLogger';
import {
  CloudFlareDetector,
  CloudFlareStatus,
  CloudFlareError,
  CloudFlareCookieManager,
} from './cloudflare';
import { loadHtml, ParsedHtml } from './htmlParser';

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface RequestOptions extends AxiosRequestConfig {
  referer?: string;
  sourceId?: string;
  silent?: boolean;
}

export class SourceHttpClient {
  private static instance: SourceHttpClient;

  public static getInstance(): SourceHttpClient {
    if (!SourceHttpClient.instance) {
      SourceHttpClient.instance = new SourceHttpClient();
    }
    return SourceHttpClient.instance;
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return '';
    }
  }

  private applyCookies(url: string, headers: Record<string, string>): void {
    const domain = this.extractDomain(url);
    if (!domain) return;
    const cookie = CloudFlareCookieManager.getCookie(domain);
    if (cookie && !headers['Cookie'] && !headers['cookie']) {
      headers['Cookie'] = cookie;
    }
  }

  /**
   * Fetches an HTML page and returns a ready-to-query HTML parser instance ($)
   */
  public async fetchHtml(
    url: string,
    options: RequestOptions = {}
  ): Promise<ParsedHtml> {
    const startTime = Date.now();
    const sourceId = options.sourceId || 'Source';

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(options.referer ? { Referer: options.referer } : {}),
      ...(options.headers as Record<string, string>),
    };

    this.applyCookies(url, headers);

    try {
      const response: AxiosResponse<string> = await axios.get(url, {
        timeout: 15000,
        ...options,
        headers,
        responseType: 'text',
      });

      const durationMs = Date.now() - startTime;
      ApiLogger.logRequest({
        timestamp: Date.now(),
        method: `SCRAPE:${sourceId}`,
        url,
        status: response.status,
        statusText: response.statusText,
        durationMs,
      });

      return loadHtml(response.data);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const status = err.response?.status || null;
      const responseData = typeof err.response?.data === 'string' ? err.response.data : '';
      const domain = this.extractDomain(url);

      // Check for Cloudflare protection
      if (status) {
        const cfStatus = CloudFlareDetector.check(status, responseData, err.response?.headers);
        if (cfStatus === CloudFlareStatus.CAPTCHA_CHALLENGE) {
          const cfErr = new CloudFlareError(
            `[${sourceId}] Cloudflare verification challenge detected at ${url}. Solve the challenge in browser or configure clearance cookie to continue.`,
            sourceId,
            url,
            domain,
            CloudFlareStatus.CAPTCHA_CHALLENGE
          );
          ApiLogger.logRequest({
            timestamp: Date.now(),
            method: `SCRAPE:${sourceId}`,
            url,
            status,
            statusText: 'Cloudflare Challenge',
            durationMs,
            error: cfErr.message,
          });
          throw cfErr;
        } else if (cfStatus === CloudFlareStatus.ACCESS_BLOCKED) {
          const cfErr = new CloudFlareError(
            `[${sourceId}] Cloudflare IP or region blocked at ${url}.`,
            sourceId,
            url,
            domain,
            CloudFlareStatus.ACCESS_BLOCKED
          );
          ApiLogger.logRequest({
            timestamp: Date.now(),
            method: `SCRAPE:${sourceId}`,
            url,
            status,
            statusText: 'Cloudflare Blocked',
            durationMs,
            error: cfErr.message,
          });
          throw cfErr;
        }
      }

      ApiLogger.logRequest({
        timestamp: Date.now(),
        method: `SCRAPE:${sourceId}`,
        url,
        status,
        statusText: err.message,
        durationMs,
        error: err.message,
      });

      throw err;
    }
  }

  /**
   * Fetches JSON payload
   */
  public async fetchJson<T = any>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const sourceId = options.sourceId || 'Source';

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'application/json, text/plain, */*',
      ...(options.referer ? { Referer: options.referer } : {}),
      ...(options.headers as Record<string, string>),
    };

    this.applyCookies(url, headers);

    try {
      const response = await axios.get<T>(url, {
        timeout: 15000,
        ...options,
        headers,
      });

      if (!options.silent) {
        ApiLogger.logRequest({
          timestamp: Date.now(),
          method: `GET_JSON:${sourceId}`,
          url,
          status: response.status,
          durationMs: Date.now() - startTime,
        });
      }

      return response.data;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const status = err.response?.status || null;
      const responseData = typeof err.response?.data === 'string' ? err.response.data : '';
      const domain = this.extractDomain(url);

      if (status) {
        const cfStatus = CloudFlareDetector.check(status, responseData, err.response?.headers);
        if (cfStatus === CloudFlareStatus.CAPTCHA_CHALLENGE) {
          const cfErr = new CloudFlareError(
            `[${sourceId}] Cloudflare verification challenge detected at ${url}.`,
            sourceId,
            url,
            domain,
            CloudFlareStatus.CAPTCHA_CHALLENGE
          );
          throw cfErr;
        }
      }

      if (!options.silent) {
        ApiLogger.logRequest({
          timestamp: Date.now(),
          method: `GET_JSON:${sourceId}`,
          url,
          status: err.response?.status || null,
          durationMs,
          error: err.message,
        });
      }
      throw err;
    }
  }

  /**
   * Fetches plain text or raw string payload (e.g. for JS files or non-JSON endpoints)
   */
  public async fetchText(
    url: string,
    options: RequestOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    const sourceId = options.sourceId || 'Source';

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/plain, application/javascript, */*',
      ...(options.referer ? { Referer: options.referer } : {}),
      ...(options.headers as Record<string, string>),
    };

    this.applyCookies(url, headers);

    try {
      const response = await axios.get<string>(url, {
        timeout: 15000,
        ...options,
        headers,
        responseType: 'text',
      });

      if (!options.silent) {
        ApiLogger.logRequest({
          timestamp: Date.now(),
          method: `GET_TEXT:${sourceId}`,
          url,
          status: response.status,
          durationMs: Date.now() - startTime,
        });
      }

      return response.data;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const status = err.response?.status || null;
      const responseData = typeof err.response?.data === 'string' ? err.response.data : '';
      const domain = this.extractDomain(url);

      if (status) {
        const cfStatus = CloudFlareDetector.check(status, responseData, err.response?.headers);
        if (cfStatus === CloudFlareStatus.CAPTCHA_CHALLENGE) {
          const cfErr = new CloudFlareError(
            `[${sourceId}] Cloudflare verification challenge detected at ${url}.`,
            sourceId,
            url,
            domain,
            CloudFlareStatus.CAPTCHA_CHALLENGE
          );
          throw cfErr;
        }
      }

      if (!options.silent) {
        ApiLogger.logRequest({
          timestamp: Date.now(),
          method: `GET_TEXT:${sourceId}`,
          url,
          status: err.response?.status || null,
          durationMs,
          error: err.message,
        });
      }
      throw err;
    }
  }

  /**
   * Fetches binary ArrayBuffer payload (for Nozomi index and range requests)
   */
  public async fetchBuffer(
    url: string,
    options: RequestOptions = {}
  ): Promise<ArrayBuffer> {
    const startTime = Date.now();
    const sourceId = options.sourceId || 'Source';

    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      ...(options.referer ? { Referer: options.referer } : {}),
      ...(options.headers as Record<string, string>),
    };

    this.applyCookies(url, headers);

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        ...options,
        headers,
        responseType: 'arraybuffer',
      });

      if (!options.silent) {
        ApiLogger.logRequest({
          timestamp: Date.now(),
          method: `GET_BIN:${sourceId}`,
          url,
          status: response.status,
          durationMs: Date.now() - startTime,
        });
      }

      return response.data;
    } catch (err: any) {
      if (!options.silent) {
        ApiLogger.logRequest({
          timestamp: Date.now(),
          method: `GET_BIN:${sourceId}`,
          url,
          status: err.response?.status || null,
          durationMs: Date.now() - startTime,
          error: err.message,
        });
      }
      throw err;
    }
  }

  /**
   * Performs an HTTP POST request (e.g. for AJAX chapter loading or search)
   */
  public async postForm(
    url: string,
    data: any,
    options: RequestOptions = {}
  ): Promise<string> {
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.referer ? { Referer: options.referer } : {}),
      ...(options.headers as Record<string, string>),
    };

    this.applyCookies(url, headers);

    const startTime = Date.now();
    const sourceId = options.sourceId || 'Source';
    try {
      const response = await axios.post(url, data, {
        timeout: 15000,
        ...options,
        headers,
        responseType: 'text',
      });
      ApiLogger.logRequest({
        timestamp: Date.now(),
        method: `POST_FORM:${sourceId}`,
        url,
        status: response.status,
        statusText: response.statusText,
        durationMs: Date.now() - startTime,
      });
      return response.data;
    } catch (err: any) {
      ApiLogger.logRequest({
        timestamp: Date.now(),
        method: `POST_FORM:${sourceId}`,
        url,
        status: err.response?.status || null,
        statusText: err.message,
        durationMs: Date.now() - startTime,
        error: err.message,
      });
      throw err;
    }
  }
}

export const sourceHttpClient = SourceHttpClient.getInstance();
