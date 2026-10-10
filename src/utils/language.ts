/**
 * Language Utilities — ISO language codes to flags, names & formatting
 */

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
  countryCode: string;
  flagUrl: string;
}

const LANGUAGE_MAP: Record<string, { name: string; flag: string; countryCode: string }> = {
  en: { name: 'English', flag: '🇬🇧', countryCode: 'gb' },
  'en-us': { name: 'English (US)', flag: '🇺🇸', countryCode: 'us' },
  'en-gb': { name: 'English (UK)', flag: '🇬🇧', countryCode: 'gb' },
  ja: { name: 'Japanese', flag: '🇯🇵', countryCode: 'jp' },
  es: { name: 'Spanish', flag: '🇪🇸', countryCode: 'es' },
  'es-la': { name: 'Spanish (LATAM)', flag: '🇲🇽', countryCode: 'mx' },
  'pt-br': { name: 'Portuguese (BR)', flag: '🇧🇷', countryCode: 'br' },
  pt: { name: 'Portuguese', flag: '🇵🇹', countryCode: 'pt' },
  fr: { name: 'French', flag: '🇫🇷', countryCode: 'fr' },
  id: { name: 'Indonesian', flag: '🇮🇩', countryCode: 'id' },
  ru: { name: 'Russian', flag: '🇷🇺', countryCode: 'ru' },
  de: { name: 'German', flag: '🇩🇪', countryCode: 'de' },
  it: { name: 'Italian', flag: '🇮🇹', countryCode: 'it' },
  vi: { name: 'Vietnamese', flag: '🇻🇳', countryCode: 'vn' },
  zh: { name: 'Chinese (Simplified)', flag: '🇨🇳', countryCode: 'cn' },
  'zh-hk': { name: 'Chinese (Traditional)', flag: '🇭🇰', countryCode: 'hk' },
  ko: { name: 'Korean', flag: '🇰🇷', countryCode: 'kr' },
  th: { name: 'Thai', flag: '🇹🇭', countryCode: 'th' },
  tr: { name: 'Turkish', flag: '🇹🇷', countryCode: 'tr' },
  ar: { name: 'Arabic', flag: '🇸🇦', countryCode: 'sa' },
  pl: { name: 'Polish', flag: '🇵🇱', countryCode: 'pl' },
  uk: { name: 'Ukrainian', flag: '🇺🇦', countryCode: 'ua' },
  tl: { name: 'Filipino / Tagalog', flag: '🇵🇭', countryCode: 'ph' },
  ms: { name: 'Malay', flag: '🇲🇾', countryCode: 'my' },
  hi: { name: 'Hindi', flag: '🇮🇳', countryCode: 'in' },
  fa: { name: 'Persian', flag: '🇮🇷', countryCode: 'ir' },
  hu: { name: 'Hungarian', flag: '🇭🇺', countryCode: 'hu' },
  cs: { name: 'Czech', flag: '🇨🇿', countryCode: 'cz' },
  nl: { name: 'Dutch', flag: '🇳🇱', countryCode: 'nl' },
  sv: { name: 'Swedish', flag: '🇸🇪', countryCode: 'se' },
  el: { name: 'Greek', flag: '🇬🇷', countryCode: 'gr' },
  he: { name: 'Hebrew', flag: '🇮🇱', countryCode: 'il' },
  ro: { name: 'Romanian', flag: '🇷🇴', countryCode: 'ro' },
  bg: { name: 'Bulgarian', flag: '🇧🇬', countryCode: 'bg' },
  da: { name: 'Danish', flag: '🇩🇰', countryCode: 'dk' },
  fi: { name: 'Finnish', flag: '🇫🇮', countryCode: 'fi' },
  no: { name: 'Norwegian', flag: '🇳🇴', countryCode: 'no' },
};

export function getLanguageInfo(code: string): LanguageInfo {
  if (!code) {
    return {
      code: 'en',
      name: 'English',
      flag: '🇺🇸',
      countryCode: 'us',
      flagUrl: 'https://flagcdn.com/w40/us.png',
    };
  }
  const normalized = code.toLowerCase().trim();
  const entry = LANGUAGE_MAP[normalized];
  if (entry) {
    return {
      code: normalized,
      name: entry.name,
      flag: entry.flag,
      countryCode: entry.countryCode,
      flagUrl: `https://flagcdn.com/w40/${entry.countryCode}.png`,
    };
  }
  // Fallback for sub-locales or unlisted codes
  const baseCode = normalized.split('-')[0];
  const baseEntry = LANGUAGE_MAP[baseCode];
  if (baseEntry) {
    return {
      code: normalized,
      name: `${baseEntry.name} (${normalized.toUpperCase()})`,
      flag: baseEntry.flag,
      countryCode: baseEntry.countryCode,
      flagUrl: `https://flagcdn.com/w40/${baseEntry.countryCode}.png`,
    };
  }

  return {
    code: normalized,
    name: normalized.toUpperCase(),
    flag: '🌐',
    countryCode: 'un',
    flagUrl: 'https://flagcdn.com/w40/un.png',
  };
}

/**
 * Detects the language code ('en', 'ja', 'zh', etc.) from title, tag IDs, or tags
 */
export function detectMangaLanguage(
  title?: string,
  tagIds?: number[],
  tags?: string[],
  sourceId?: string
): string | undefined {
  // 1. NHentai tag IDs (12227: english, 29963: chinese, 6346: japanese)
  if (Array.isArray(tagIds)) {
    if (tagIds.includes(12227)) return 'en';
    if (tagIds.includes(29963)) return 'zh';
    if (tagIds.includes(6346)) return 'ja';
  }

  // 2. Tags list inspection
  if (Array.isArray(tags)) {
    for (const t of tags) {
      const lower = t.toLowerCase().trim();
      if (lower === 'english' || lower === 'language:english' || lower === 'lang:english') return 'en';
      if (lower === 'chinese' || lower === 'language:chinese' || lower === 'lang:chinese') return 'zh';
      if (lower === 'japanese' || lower === 'language:japanese' || lower === 'lang:japanese') return 'ja';
    }
  }

  // 3. Title patterns inspection
  if (title) {
    const t = title.toLowerCase();
    // English indicators
    if (/(?:\[|\()(?:english|eng)(?:\]|\))/i.test(t)) {
      return 'en';
    }
    // Chinese indicators
    if (/(?:\[|\()(?:chinese|中国翻訳|中國翻譯|漢化|汉化|中国語|個人漢化|臉腫漢化組|绅士仓库汉化)(?:\]|\))/i.test(title)) {
      return 'zh';
    }
    // Japanese indicators
    if (/(?:\[|\()(?:japanese|dl版|digital|無修正)(?:\]|\))/i.test(title)) {
      return 'ja';
    }
    // Japanese Kana characters in title
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(title)) {
      return 'ja';
    }
  }

  // 4. Default for Japanese-origin sources like NHentai / Hitomi
  if (sourceId === 'nhentai' || sourceId === 'hitomila') {
    return 'ja';
  }

  return undefined;
}
