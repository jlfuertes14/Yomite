/**
 * Cloudflare and Anti-DDoS Protection Detector & Clearance Cookie Manager
 * Ported from Kotatsu's CloudFlareHelper.kt and Tachiyomi/Mihon Cloudflare interceptor.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CloudFlareStatus = {
  NOT_DETECTED: 0,
  CAPTCHA_CHALLENGE: 1,
  ACCESS_BLOCKED: 2,
} as const;

export type CloudFlareStatusType =
  (typeof CloudFlareStatus)[keyof typeof CloudFlareStatus];

export class CloudFlareError extends Error {
  public readonly isCloudFlare = true;
  public readonly domain: string;
  public readonly url: string;
  public readonly sourceId: string;
  public readonly cfStatus: CloudFlareStatusType;

  constructor(
    message: string,
    sourceId: string,
    url: string,
    domain: string,
    cfStatus: CloudFlareStatusType
  ) {
    super(message);
    this.name = 'CloudFlareError';
    this.sourceId = sourceId;
    this.url = url;
    this.domain = domain;
    this.cfStatus = cfStatus;
    Object.setPrototypeOf(this, CloudFlareError.prototype);
  }
}

export class CloudFlareDetector {
  /**
   * Checks HTTP status, headers, and body text for Cloudflare bot challenge signals
   */
  public static check(
    status: number,
    htmlContent: string,
    headers?: Record<string, any>
  ): CloudFlareStatusType {
    if (status !== 403 && status !== 503) {
      return CloudFlareStatus.NOT_DETECTED;
    }

    const headerCfMitigated = headers?.['cf-mitigated'] || headers?.['Cf-Mitigated'];
    if (headerCfMitigated === 'challenge') {
      return CloudFlareStatus.CAPTCHA_CHALLENGE;
    }

    if (!htmlContent) {
      // If 403/503 from Cloudflare server without body
      const server = headers?.['server'] || headers?.['Server'];
      if (typeof server === 'string' && server.toLowerCase().includes('cloudflare')) {
        return CloudFlareStatus.CAPTCHA_CHALLENGE;
      }
      return CloudFlareStatus.NOT_DETECTED;
    }

    const lower = htmlContent.toLowerCase();

    // Cloudflare IP / Access Block
    if (
      lower.includes('blocked_why_headline') ||
      lower.includes('access-denied-header') ||
      lower.includes('cf-error-overview') ||
      lower.includes('error 1020') ||
      lower.includes('error 1015')
    ) {
      return CloudFlareStatus.ACCESS_BLOCKED;
    }

    // Cloudflare Turnstile / JS Challenge / Captcha
    if (
      lower.includes('just a moment...') ||
      lower.includes('challenge-error-title') ||
      lower.includes('challenge-error-text') ||
      lower.includes('challenge-platform') ||
      lower.includes('cf-turnstile') ||
      lower.includes('challenges.cloudflare.com') ||
      lower.includes('cf-chl-bypass') ||
      lower.includes('checking your browser before accessing') ||
      lower.includes('verify you are human') ||
      lower.includes('ray id') ||
      lower.includes('cf-ray')
    ) {
      return CloudFlareStatus.CAPTCHA_CHALLENGE;
    }

    return CloudFlareStatus.NOT_DETECTED;
  }

  /**
   * Checks if an HTML content contains Cloudflare / Turnstile challenge signals
   */
  public static isChallengePage(htmlContent: string): boolean {
    if (!htmlContent) return false;
    const lower = htmlContent.toLowerCase();
    return (
      lower.includes('challenge-platform') ||
      lower.includes('challenges.cloudflare.com') ||
      lower.includes('cf-turnstile') ||
      lower.includes('just a moment...') ||
      lower.includes('verify you are human') ||
      lower.includes('challenge-error-title')
    );
  }
}

const STORAGE_KEY_CF_COOKIES = '@mangaapp_cf_cookies_v1';

class CloudFlareCookieManagerService {
  private cookies: Map<string, string> = new Map();
  private initialized = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_CF_COOKIES);
      if (stored) {
        const parsed: Record<string, string> = JSON.parse(stored);
        for (const [domain, cookie] of Object.entries(parsed)) {
          this.cookies.set(this.normalizeDomain(domain), cookie);
        }
      }
    } catch {
      // Fallback
    } finally {
      this.initialized = true;
    }
  }

  public getCookie(domain: string): string | null {
    const normalized = this.normalizeDomain(domain);
    return this.cookies.get(normalized) || null;
  }

  public async setCookie(domain: string, cookie: string): Promise<void> {
    const normalized = this.normalizeDomain(domain);
    const cleaned = cookie.trim();
    if (!cleaned) {
      this.cookies.delete(normalized);
    } else {
      this.cookies.set(normalized, cleaned);
    }
    await this.persist();
  }

  public async removeCookie(domain: string): Promise<void> {
    const normalized = this.normalizeDomain(domain);
    this.cookies.delete(normalized);
    await this.persist();
  }

  public hasCookie(domain: string): boolean {
    const normalized = this.normalizeDomain(domain);
    return this.cookies.has(normalized);
  }

  private async persist(): Promise<void> {
    try {
      const obj: Record<string, string> = {};
      for (const [k, v] of this.cookies.entries()) {
        obj[k] = v;
      }
      await AsyncStorage.setItem(STORAGE_KEY_CF_COOKIES, JSON.stringify(obj));
    } catch {
      // Ignore storage errors
    }
  }

  private normalizeDomain(domainOrUrl: string): string {
    let clean = domainOrUrl.toLowerCase().trim();
    clean = clean.replace(/^https?:\/\//, '');
    clean = clean.replace(/\/.*$/, '');
    clean = clean.replace(/:\d+$/, '');
    return clean;
  }
}

export const CloudFlareCookieManager = new CloudFlareCookieManagerService();
