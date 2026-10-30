/**
 * Community Screen — High-Craft "Threads" Inspired Feed & Discussion Architecture
 * Crafted with Impeccable & Taste standards and Emil Kowalski motion principles:
 * - 2-Column signature feed: Left author avatar + continuous thread connector line; Right author handle, timestamp, body, media & 4-action row
 * - Flat underline tab navigation (For You, Anime News, Theories, Recommendations)
 * - Full-bleed thread discussion conversation with direct manipulation
 * - Snappy spring micro-interactions (scale 0.97, custom bezier curves)
 * - Zero AI slop: Borderless flat stream, strict typographic hierarchy, zero emojis as UI icons
 */
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput, type TextInputInstance,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';

import { Radius, Spacing, Typography } from '../../constants/Colors';
import {
  AnimeNewsArticle,
  AnimeNewsItem,
  fetchAuthorAvatarMap,
  ForumComment,
  ForumThread,
  getAnimeNews,
  getAnimeNewsArticle,
  getCommunityThreads,
  getNewsSourceFavicon,
  getThreadReplies,
  mergeNewsCoversIntoFeedCache,
} from '../../src/api/community';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { useCommunityStore } from '../../src/store/communityStore';
import { getUserAvatarUrl, getUserDisplayName, useUserStore } from '../../src/store/userStore';
import { formatChapterDate } from '../../src/utils/date';
import { triggerHaptic } from '../../src/utils/haptics';

import * as FileSystem from 'expo-file-system';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { AuthModal } from '../../src/components/AuthModal';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { AppRefreshControl } from '../../src/components/AppRefreshControl';
import {
  AnimeNewsArticleSkeleton,
  AnimeNewsCardSkeleton,
  ThreadCardSkeleton,
  ThreadReplySkeleton,
} from '../../src/components/Skeleton';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { ZoomableImage } from '../../src/components/ZoomableImage';
import { isGifAsset, MAX_GIF_BYTES, MAX_PHOTO_BYTES } from '../../src/services/communityMediaService';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';

const MAX_UPLOAD_IMAGES = 4;

/**
 * Format relative timestamps into Threads style:
 * <1m -> "now", <60m -> "Xm", <24h -> "Xh", <7d -> "Xd", else "MMM D"
 */
function formatThreadTime(dateString?: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'now';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format full timestamp for Thread detail view (e.g. "4:20 PM · Oct 15, 2026")
 */
function formatFullThreadTime(dateString?: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }) + ' · ' + date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Image picker with max image cap and file size limits:
 * - Max 4 images
 * - Max 5MB for GIFs
 * - Max 10MB for static photos
 */
async function pickCommunityImages(
  existing: string[],
  onError?: (msg: string) => void
): Promise<string[]> {
  const remaining = MAX_UPLOAD_IMAGES - existing.length;
  if (remaining <= 0) return existing;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 0.8,
  });
  if (result.canceled) return existing;

  const validUris: string[] = [];
  let exceededLimit = false;

  for (const asset of result.assets) {
    if (!asset.uri) continue;
    const isGif = isGifAsset(asset.uri, asset.mimeType);
    const maxBytes = isGif ? MAX_GIF_BYTES : MAX_PHOTO_BYTES;

    let size = asset.fileSize;
    if (size === undefined && Platform.OS !== 'web') {
      try {
        const info = await FileSystem.getInfoAsync(asset.uri);
        if (info.exists && 'size' in info && typeof info.size === 'number') {
          size = info.size;
        }
      } catch { }
    }

    if (size && size > maxBytes) {
      exceededLimit = true;
      continue;
    }

    validUris.push(asset.uri);
  }

  if (exceededLimit && onError) {
    onError('Some files were not attached because they exceed the size limit (max 5MB for GIFs, 10MB for photos).');
  }

  return [...existing, ...validUris].slice(0, MAX_UPLOAD_IMAGES);
}

/**
 * Highlight @mentions in body text
 */
function MentionText({
  body,
  textColor,
  accentColor,
  fontSize = 15,
  lineHeight = 21,
}: {
  body: string;
  textColor: string;
  accentColor: string;
  fontSize?: number;
  lineHeight?: number;
}) {
  const parts = body.split(/(@[\w.]+)/g);
  return (
    <Text style={[styles.threadBodyText, { color: textColor, fontSize, lineHeight }]}>
      {parts.map((part, i) =>
        /^@[\w.]+$/.test(part) ? (
          <Text key={i} style={{ color: accentColor, fontWeight: '700' }}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

function isAnonymousIdentity(name?: string | null): boolean {
  if (!name) return true;
  return /^(guest|anonymous reader|yomite reader|mangadex reader)$/i.test(name.trim());
}

function resolvePostAvatar(
  storedUrl: string | null | undefined,
  authorName: string,
  myName: string,
  myAvatarUrl: string | null,
  dbAvatarUrl?: string | null
): string | null {
  if (isAnonymousIdentity(authorName)) return null;
  if (storedUrl) return storedUrl;
  if (dbAvatarUrl) return dbAvatarUrl;
  if (authorName === myName && myAvatarUrl) return myAvatarUrl;
  return null;
}

/**
 * Circular user avatar with initial letter fallback
 */
function UserAvatar({
  uri,
  name,
  size = 38,
  bgColor,
  textColor,
}: {
  uri?: string | null;
  name: string;
  size?: number;
  bgColor: string;
  textColor: string;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: textColor, fontSize: Math.max(10, size * 0.44), fontWeight: '700' }}>
        {(name || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function getYomiteTrailerEmbedUrl(url: string) {
  try {
    const embedUrl = new URL(url);
    embedUrl.searchParams.set('origin', 'https://yomite.vercel.app');
    embedUrl.searchParams.set('enablejsapi', '1');
    return embedUrl.toString();
  } catch {
    return url;
  }
}

function FormattedNewsParagraph({
  paragraph,
  colors,
}: {
  paragraph: string;
  colors: any;
}) {
  const p = paragraph.trim();
  if (!p) return null;

  // 1. Section Sub-headings (e.g. "New cast members for the second season are:", "Returning cast members include:")
  const isSectionHeading =
    (p.endsWith(':') || p.endsWith(': ')) &&
    !p.startsWith('•') &&
    p.length < 100 &&
    /(cast|staff|visual|trailer|premiered|included|voice|production|story|director|animation|members)/i.test(p);

  if (isSectionHeading) {
    return (
      <View style={styles.newsHeadingWrap}>
        <Text style={[styles.newsSectionHeading, { color: colors.text }]}>
          {p}
        </Text>
      </View>
    );
  }

  // 2. Blockquotes (e.g. “A door to another world stretches out...”)
  if (p.startsWith('“') && p.endsWith('”')) {
    return (
      <View style={[styles.newsQuoteBox, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.newsQuoteText, { color: colors.textSecondary }]}>
          {p}
        </Text>
      </View>
    );
  }

  // 3. Bullet or plain list item with Cast ("• Actor as Character" or "Actor as Character")
  const isBullet = p.startsWith('• ');
  const rawText = isBullet ? p.slice(2).trim() : p;

  if (rawText.includes(' as ')) {
    const parts = rawText.split(' as ');
    const actor = parts[0].trim();
    const character = parts.slice(1).join(' as ').trim();
    return (
      <View style={styles.newsBulletRow}>
        <Text style={[styles.newsBulletDot, { color: colors.accent }]}>•</Text>
        <Text style={[styles.newsBulletText, { color: colors.text }]}>
          <Text style={[styles.newsActorName, { color: colors.text }]}>{actor}</Text>
          <Text style={{ color: colors.textMuted }}> as </Text>
          <Text style={[styles.newsCharacterName, { color: colors.accent }]}>{character}</Text>
        </Text>
      </View>
    );
  }

  // 4. Bullet list item with Staff Role ("• Art Directors: Name1, Name2")
  if (isBullet && rawText.includes(': ')) {
    const colonIdx = rawText.indexOf(': ');
    const role = rawText.slice(0, colonIdx + 1).trim();
    const people = rawText.slice(colonIdx + 2).trim();
    return (
      <View style={styles.newsBulletRow}>
        <Text style={[styles.newsBulletDot, { color: colors.accent }]}>•</Text>
        <Text style={[styles.newsBulletText, { color: colors.text }]}>
          <Text style={[styles.newsRoleTitle, { color: colors.text }]}>{role} </Text>
          <Text style={{ color: colors.textSecondary }}>{people}</Text>
        </Text>
      </View>
    );
  }

  // 5. Generic bullet list item
  if (isBullet) {
    return (
      <View style={styles.newsBulletRow}>
        <Text style={[styles.newsBulletDot, { color: colors.accent }]}>•</Text>
        <Text style={[styles.newsBulletText, { color: colors.text }]}>{rawText}</Text>
      </View>
    );
  }

  // 6. Regular paragraph with bold support (**bold** or <b>bold</b>)
  const segments = p.split(/(\*\*.*?\*\*|<b>.*?<\/b>)/g);
  return (
    <Text style={[styles.newsParagraph, { color: colors.text }]}>
      {segments.map((seg, i) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          return (
            <Text key={i} style={{ fontWeight: '700', color: colors.text }}>
              {seg.slice(2, -2)}
            </Text>
          );
        }
        if (seg.startsWith('<b>') && seg.endsWith('</b>')) {
          return (
            <Text key={i} style={{ fontWeight: '700', color: colors.text }}>
              {seg.slice(3, -4)}
            </Text>
          );
        }
        return seg;
      })}
    </Text>
  );
}

function cleanForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z0-9#]+;/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isDuplicateSummary(summary?: string | null, paragraph?: string | null): boolean {
  if (!summary || !paragraph) return false;
  const s = cleanForComparison(summary);
  const p = cleanForComparison(paragraph);
  if (!s || !p) return false;
  // Exact match
  if (s === p) return true;
  // Substring containment for long text
  if (s.length >= 25 && p.includes(s)) return true;
  if (p.length >= 25 && s.includes(p)) return true;
  // Prefix matching (e.g. truncated summary excerpt)
  const minLen = Math.min(s.length, p.length);
  if (minLen >= 25) {
    const sPrefix = s.slice(0, Math.min(minLen, 35));
    const pPrefix = p.slice(0, Math.min(minLen, 35));
    if (sPrefix === pPrefix) return true;
  }
  // Significant word overlap
  const wordsS = new Set(
    summary.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 3)
  );
  const wordsP = paragraph.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 3);
  if (wordsS.size >= 4) {
    let common = 0;
    for (const w of wordsP) {
      if (wordsS.has(w)) common++;
    }
    if (common / wordsS.size >= 0.65) return true;
  }
  return false;
}

function normalizeNewsImageUrl(url?: string | null): string {
  if (!url) return '';
  try {
    const clean = url.split('?')[0].split('#')[0];
    const unresized = clean.replace(/-\d+x\d+(\.[a-zA-Z0-9]+)$/, '$1');
    const filename = unresized.split('/').pop() || unresized;
    return filename.toLowerCase().trim();
  } catch {
    return (url || '').toLowerCase().trim();
  }
}

function NewsGalleryVisualCard({
  uri,
  index,
  onPress,
}: {
  uri: string;
  index: number;
  onPress: () => void;
}) {
  const [aspectRatio, setAspectRatio] = useState<number>(() => {
    const match = uri.match(/[-_](\d+)x(\d+)/i);
    if (match) {
      const w = parseInt(match[1], 10);
      const h = parseInt(match[2], 10);
      if (w > 0 && h > 0) return w / h;
    }
    return 0.72;
  });

  useEffect(() => {
    Image.getSize(
      uri,
      (width, height) => {
        if (width > 0 && height > 0) {
          setAspectRatio(width / height);
        }
      },
      () => { }
    );
  }, [uri]);

  const CARD_HEIGHT = 320;
  const clampedRatio = Math.max(0.55, Math.min(aspectRatio, 1.85));
  const cardWidth = Math.round(CARD_HEIGHT * clampedRatio);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.newsGalleryCardDynamic,
        {
          width: cardWidth,
          height: CARD_HEIGHT,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`View visual ${index + 1}`}
    >
      <Image
        source={{ uri }}
        style={styles.newsGalleryThumbDynamic}
        resizeMode="cover"
      />
    </Pressable>
  );
}

type TabType = 'for_you' | 'news' | 'theories' | 'recommendations';

export default function CommunityScreen() {
  useDocumentTitle('Community');
  const router = useRouter();
  const colors = useThemeColors();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const user = useUserStore((s) => s.user);

  const {
    userThreads,
    threadReplies,
    createThread,
    deleteThread,
    addReply,
    deleteReply,
    likeThread,
    likeReply,
  } = useCommunityStore();

  const [activeTab, setActiveTab] = useState<TabType>('for_you');
  const [animeNews, setAnimeNews] = useState<AnimeNewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<AnimeNewsArticle | null>(null);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);
  const [isNewsArticleLoading, setIsNewsArticleLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Sorting
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicSort, setTopicSort] = useState<'latest' | 'popular'>('latest');

  // Interactive Thread Discussion View State
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumComment[]>([]);
  const [isRepliesLoading, setIsRepliesLoading] = useState(false);
  const [newReplyText, setNewReplyText] = useState('');

  // Likes & Reposts Local Cache (Optimistic UI feedback)
  const [likedThreadIds, setLikedThreadIds] = useState<Set<string>>(new Set());
  const [repostedThreadIds, setRepostedThreadIds] = useState<Set<string>>(new Set());
  const [likedReplyIds, setLikedReplyIds] = useState<Set<string>>(new Set());

  // Create Topic & Auth Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicBody, setTopicBody] = useState('');
  const [topicCategory, setTopicCategory] = useState<'Discussion' | 'Theories' | 'Recommendations'>('Discussion');
  const [topicImages, setTopicImages] = useState<string[]>([]);
  const [isPostingTopic, setIsPostingTopic] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Reply Composer State
  const [replyImages, setReplyImages] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const replyInputRef = useRef<TextInputInstance>(null);

  // User Profile Data
  const myAvatarUrl = getUserAvatarUrl(user);
  const myDisplayName = user ? getUserDisplayName(user) : '';

  // Avatar Map
  const [dbAvatars, setDbAvatars] = useState<Record<string, string>>({});
  const fetchedAvatarNames = useRef<Set<string>>(new Set());
  const ensureDbAvatars = useMemo(
    () => async (names: string[]) => {
      const fresh = names.filter(
        (n) => n && !isAnonymousIdentity(n) && !fetchedAvatarNames.current.has(n)
      );
      if (fresh.length === 0) return;
      fresh.forEach((n) => fetchedAvatarNames.current.add(n));
      const map = await fetchAuthorAvatarMap(fresh);
      if (Object.keys(map).length > 0) {
        setDbAvatars((prev) => ({ ...prev, ...map }));
      }
    },
    []
  );

  // Confirmation Modal
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName?: keyof typeof Ionicons.glyphMap;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'destructive' | 'primary' | 'success';
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const [remoteThreads, setRemoteThreads] = useState<ForumThread[]>([]);

  // Seamless Android Back Navigation: return to More hub instead of Discover
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (fullscreenImageUri) {
          setFullscreenImageUri(null);
          return true;
        }
        if (selectedNews) {
          setSelectedNews(null);
          return true;
        }
        if (selectedThread) {
          setSelectedThread(null);
          return true;
        }
        if (showCreateModal) {
          setShowCreateModal(false);
          return true;
        }
        if (authModalVisible) {
          setAuthModalVisible(false);
          return true;
        }
        if (confirmModalConfig.visible) {
          setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
          return true;
        }
        if (searchOpen) {
          setSearchOpen(false);
          return true;
        }
        if (drawerVisible) {
          setDrawerVisible(false);
          return true;
        }
        router.replace('/(tabs)/more');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [
      fullscreenImageUri,
      selectedNews,
      selectedThread,
      showCreateModal,
      authModalVisible,
      confirmModalConfig.visible,
      searchOpen,
      drawerVisible,
      router,
    ])
  );

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setIsLoading(true);
    const [news, threads] = await Promise.all([
      getAnimeNews(),
      getCommunityThreads(),
    ]);
    setAnimeNews(news);
    setRemoteThreads(threads);
    hydrateNewsImages(news);
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const [news, threads] = await Promise.all([
      getAnimeNews(true),
      getCommunityThreads(),
    ]);
    setAnimeNews(news);
    setRemoteThreads(threads);
    hydrateNewsImages(news);
    setRefreshing(false);
  };

  const applyCoverUpdates = (
    updates: Array<{
      id: string;
      url: string;
      imageUrl?: string;
      images?: string[];
      trailerUrl?: string;
      trailerUrls?: string[];
    }>
  ) => {
    const withCover = updates.filter((u) => u.imageUrl || u.images?.[0]);
    if (withCover.length === 0) return;
    setAnimeNews((current) =>
      current.map((item) => {
        const update = withCover.find(
          (candidate) => candidate.id === item.id || candidate.url === item.url
        );
        if (!update) return item;
        const cover = update.imageUrl || update.images?.[0];
        return {
          ...item,
          imageUrl: item.imageUrl || cover,
          images: item.images || update.images,
          trailerUrl: item.trailerUrl || update.trailerUrl,
          trailerUrls: item.trailerUrls || update.trailerUrls,
        };
      })
    );
    mergeNewsCoversIntoFeedCache(withCover);
  };

  const hydrateNewsImages = (items: AnimeNewsItem[]) => {
    const missingImages = items
      .filter((item) => !item.imageUrl && !(item.images && item.images.length > 0))
      .slice(0, 12);
    if (missingImages.length === 0) return;

    Promise.all(
      missingImages.map(async (item) => {
        const article = await getAnimeNewsArticle(item.url);
        return {
          id: item.id,
          url: item.url,
          imageUrl: article?.imageUrl,
          images: article?.images,
          trailerUrl: article?.trailerUrl,
          trailerUrls: article?.trailerUrls,
        };
      })
    ).then((updates) => {
      applyCoverUpdates(updates);
    });
  };

  const handleOpenNews = async (item: AnimeNewsItem) => {
    setSelectedNews({ ...item, content: [] });
    setIsNewsArticleLoading(true);
    const article = await getAnimeNewsArticle(item.url);
    if (article) {
      setSelectedNews(article);
      applyCoverUpdates([
        {
          id: item.id,
          url: item.url,
          imageUrl: article.imageUrl,
          images: article.images,
          trailerUrl: article.trailerUrl,
          trailerUrls: article.trailerUrls,
        },
      ]);
    }
    setIsNewsArticleLoading(false);
  };

  const shouldShowNewsSummary = useMemo(() => {
    if (!selectedNews?.summary) return false;
    if (isNewsArticleLoading || !selectedNews.content || selectedNews.content.length === 0) {
      return true;
    }
    const firstParagraph = selectedNews.content[0];
    if (isDuplicateSummary(selectedNews.summary, firstParagraph)) {
      return false;
    }
    return true;
  }, [selectedNews?.summary, selectedNews?.content, isNewsArticleLoading]);

  const articleParagraphs = useMemo(() => {
    if (!selectedNews?.content) return [];
    const summary = selectedNews.summary?.trim();
    return selectedNews.content.filter((paragraph, index) => {
      if (!paragraph || !paragraph.trim()) return false;
      if (shouldShowNewsSummary && summary && isDuplicateSummary(summary, paragraph)) {
        return false;
      }
      if (index > 0 && isDuplicateSummary(selectedNews.content[0], paragraph)) {
        return false;
      }
      return true;
    });
  }, [selectedNews?.content, selectedNews?.summary, shouldShowNewsSummary]);

  const newsCoverUri = selectedNews?.imageUrl || selectedNews?.images?.[0] || null;

  const galleryVisuals = useMemo(() => {
    if (!selectedNews?.images || selectedNews.images.length === 0) return [];

    const coverKey = normalizeNewsImageUrl(newsCoverUri);

    // If anime news content has only one image and it's already used by the cover image (or is the cover image),
    // do not render the official visuals / key visuals gallery
    if (selectedNews.images.length === 1) {
      const singleKey = normalizeNewsImageUrl(selectedNews.images[0]);
      if (!coverKey || singleKey === coverKey) {
        return [];
      }
    }

    // Filter out any image that is already displayed as the main hero cover
    const distinctVisuals = selectedNews.images.filter(
      (img) => normalizeNewsImageUrl(img) !== coverKey
    );

    return distinctVisuals;
  }, [selectedNews?.images, newsCoverUri]);

  const combinedThreads = useMemo(() => {
    const threadMap = new Map<string, ForumThread>();
    for (const t of userThreads) {
      const replies = threadReplies[t.id];
      const validReplies = replies
        ? replies.filter((r) => !(r.username === t.author && r.body.trim() === t.body.trim()))
        : undefined;
      const accurateRepliesCount = validReplies !== undefined ? validReplies.length : t.repliesCount;
      threadMap.set(t.id, {
        ...t,
        repliesCount: accurateRepliesCount,
      });
    }
    for (const t of remoteThreads) {
      if (!threadMap.has(t.id)) {
        const replies = threadReplies[t.id];
        const validReplies = replies
          ? replies.filter((r) => !(r.username === t.author && r.body.trim() === t.body.trim()))
          : undefined;
        const accurateRepliesCount = validReplies !== undefined ? Math.max(validReplies.length, t.repliesCount || 0) : (t.repliesCount || 0);
        threadMap.set(t.id, {
          ...t,
          repliesCount: accurateRepliesCount,
        });
      }
    }
    return Array.from(threadMap.values());
  }, [userThreads, remoteThreads, threadReplies]);

  const filteredThreads = useMemo(() => {
    return combinedThreads
      .filter((t) => {
        // Tab category filter
        if (activeTab === 'theories') {
          if (!t.category.toLowerCase().includes('theor') && !t.title.toLowerCase().includes('theor')) return false;
        } else if (activeTab === 'recommendations') {
          if (!t.category.toLowerCase().includes('recommend') && !t.title.toLowerCase().includes('recommend')) return false;
        }
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q) || t.author.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (topicSort === 'popular') return b.repliesCount - a.repliesCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [combinedThreads, activeTab, searchQuery, topicSort]);

  useEffect(() => {
    ensureDbAvatars(combinedThreads.map((t) => t.author));
  }, [combinedThreads, ensureDbAvatars]);

  const handleOpenThread = async (thread: ForumThread) => {
    setSelectedThread(thread);
    setIsRepliesLoading(true);

    const storedReplies = threadReplies[thread.id]?.filter(
      (r) => !(r.username === thread.author && r.body.trim() === thread.body.trim())
    );
    let fetchedReplies: ForumComment[] = [];
    if (storedReplies && storedReplies.length > 0) {
      fetchedReplies = storedReplies;
    } else {
      const serverReplies = await getThreadReplies(thread.id);
      fetchedReplies = serverReplies.filter(
        (r) => !(r.username === thread.author && r.body.trim() === thread.body.trim())
      );
    }
    setReplies(fetchedReplies);
    ensureDbAvatars([thread.author, ...fetchedReplies.map((r) => r.username)]);
    setSelectedThread((prev) => (prev ? { ...prev, repliesCount: fetchedReplies.length } : null));
    setRemoteThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, repliesCount: fetchedReplies.length } : t))
    );
    setIsRepliesLoading(false);
  };

  const handleOpenCreateTopic = () => {
    if (!user) {
      setConfirmModalConfig({
        visible: true,
        title: 'Sign In Required',
        message: 'Please sign in or create an account to start discussion threads.',
        iconName: 'lock-closed-outline',
        confirmText: 'Sign In',
        cancelText: 'Cancel',
        confirmVariant: 'primary',
        onConfirm: () => {
          setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
          setAuthModalVisible(true);
        },
      });
      return;
    }
    setShowCreateModal(true);
  };

  const handleSendReply = async () => {
    if (!user) {
      setConfirmModalConfig({
        visible: true,
        title: 'Sign In Required',
        message: 'Please sign in or create an account to reply to community threads.',
        iconName: 'lock-closed-outline',
        confirmText: 'Sign In',
        cancelText: 'Cancel',
        confirmVariant: 'primary',
        onConfirm: () => {
          setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
          setAuthModalVisible(true);
        },
      });
      return;
    }

    if ((!newReplyText.trim() && replyImages.length === 0) || !selectedThread) return;
    try {
      setIsSendingReply(true);
      const authorName = getUserDisplayName(user);
      const newReply = await addReply({
        threadId: selectedThread.id,
        body: newReplyText.trim(),
        author: authorName,
        imageUrls: replyImages,
        replyTo: replyTo ?? undefined,
        avatarUrl: isAnonymousIdentity(authorName) ? undefined : myAvatarUrl ?? undefined,
      });

      setReplies((prev) => [...prev, newReply]);
      setNewReplyText('');
      setReplyImages([]);
      setReplyTo(null);
      setSelectedThread({
        ...selectedThread,
        repliesCount: selectedThread.repliesCount + 1,
      });
      setRemoteThreads((prev) =>
        prev.map((t) => (t.id === selectedThread.id ? { ...t, repliesCount: (t.repliesCount || 0) + 1 } : t))
      );
      triggerHaptic();
    } catch (err: any) {
      setConfirmModalConfig({
        visible: true,
        title: 'Notice',
        message: err?.message || 'Failed to post reply.',
        iconName: 'alert-circle-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleMentionUser = (username: string) => {
    if (username === myDisplayName) return;
    setReplyTo(username);
    setNewReplyText((prev) => {
      const mention = `@${username} `;
      if (prev.startsWith(mention) || prev.includes(mention)) return prev;
      return `${mention}${prev}`;
    });
    replyInputRef.current?.focus();
  };

  const handleDeleteTopic = (threadId: string) => {
    setConfirmModalConfig({
      visible: true,
      title: 'Delete Thread',
      message: 'Are you sure you want to delete this thread? This action cannot be undone.',
      iconName: 'trash-outline',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmVariant: 'destructive',
      onConfirm: () => {
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
        deleteThread(threadId);
        setSelectedThread(null);
      },
    });
  };

  const handleDeleteReply = (replyId: string) => {
    if (!selectedThread) return;
    setConfirmModalConfig({
      visible: true,
      title: 'Delete Reply',
      message: 'Are you sure you want to delete this reply?',
      iconName: 'trash-outline',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmVariant: 'destructive',
      onConfirm: () => {
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
        deleteReply(selectedThread.id, replyId);
        setReplies((prev) => prev.filter((r) => r.id !== replyId));
        setSelectedThread((prev) => (prev ? { ...prev, repliesCount: Math.max(0, prev.repliesCount - 1) } : null));
        setRemoteThreads((prev) =>
          prev.map((t) => (t.id === selectedThread.id ? { ...t, repliesCount: Math.max(0, (t.repliesCount || 1) - 1) } : t))
        );
      },
    });
  };

  const handleToggleLikeThread = (threadId: string) => {
    triggerHaptic();
    setLikedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
        likeThread(threadId);
      }
      return next;
    });
  };

  const handleToggleRepostThread = (threadId: string) => {
    triggerHaptic();
    setRepostedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const handleShareThread = async (thread: ForumThread) => {
    triggerHaptic();
    try {
      await Share.share({
        title: thread.title,
        message: `${thread.title}\n\nJoin the discussion on Yomite:\nhttps://yomite.vercel.app`,
      });
    } catch { }
  };

  const handleCreateTopic = async () => {
    if (!user) {
      setConfirmModalConfig({
        visible: true,
        title: 'Sign In Required',
        message: 'Please sign in or create an account to start discussion threads.',
        iconName: 'lock-closed-outline',
        confirmText: 'Sign In',
        cancelText: 'Cancel',
        confirmVariant: 'primary',
        onConfirm: () => {
          setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
          setAuthModalVisible(true);
        },
      });
      return;
    }

    if (!topicTitle.trim() && !topicBody.trim() && topicImages.length === 0) {
      setConfirmModalConfig({
        visible: true,
        title: 'Empty Thread',
        message: 'Please enter a message or attach a photo to start your thread.',
        iconName: 'document-text-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    try {
      setIsPostingTopic(true);
      const authorName = getUserDisplayName(user);
      const titleToUse = topicTitle.trim() || topicBody.trim().slice(0, 50) || 'Community Thread';
      const created = await createThread({
        title: titleToUse,
        category: topicCategory,
        body: topicBody.trim() || titleToUse,
        author: authorName,
        imageUrls: topicImages,
        authorAvatarUrl: isAnonymousIdentity(authorName) ? undefined : myAvatarUrl ?? undefined,
      });

      setShowCreateModal(false);
      setTopicTitle('');
      setTopicBody('');
      setTopicImages([]);
      handleOpenThread(created);
      triggerHaptic();
    } catch (err: any) {
      setConfirmModalConfig({
        visible: true,
        title: 'Notice',
        message: err?.message || 'Failed to publish thread.',
        iconName: 'alert-circle-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsPostingTopic(false);
    }
  };

  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[{ flex: 1, width: '100%' }, isWeb && styles.webFeedCenter]}>

        {/* Top Header Bar */}
        <View style={[styles.threadsHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleWrap}>
            {isWeb ? (
              <Pressable
                onPress={() => setDrawerVisible(true)}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Open Navigation Menu"
                hitSlop={8}
              >
                <Ionicons name="menu" size={24} color={colors.text} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.replace('/(tabs)/more')}
                style={[styles.headerIconBtn, { marginRight: 2 }]}
                accessibilityRole="button"
                accessibilityLabel="Back to More"
                hitSlop={8}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </Pressable>
            )}
            <Text style={[styles.headerBrandTitle, { color: colors.text }]}>Community</Text>
          </View>

          <View style={styles.headerRightActions}>
            <AnimatedPressable
              onPress={() => setSearchOpen((prev) => !prev)}
              style={styles.headerIconBtn}
              scaleTo={0.93}
              accessibilityRole="button"
              accessibilityLabel="Toggle search bar"
            >
              <Ionicons
                name={searchOpen ? 'close' : 'search'}
                size={22}
                color={searchOpen ? colors.accent : colors.textSecondary}
              />
            </AnimatedPressable>

            <AnimatedPressable
              onPress={handleOpenCreateTopic}
              style={[styles.headerComposeBtn, { backgroundColor: colors.text }]}
              scaleTo={0.93}
              accessibilityRole="button"
              accessibilityLabel="New thread"
            >
              <Ionicons name="create-outline" size={17} color={colors.background} />
              <Text style={[styles.headerComposeText, { color: colors.background }]}>Post</Text>
            </AnimatedPressable>
          </View>
        </View>

        {/* Collapsible Search & Sort Bar */}
        {searchOpen && (
          <View style={[styles.searchDrawer, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.searchInputRow}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search threads, theories, or authors..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                multiline={false}
                autoFocus
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {activeTab !== 'news' && (
              <View style={styles.sortToggleRow}>
                <Text style={[styles.sortSubLabel, { color: colors.textMuted }]}>Sort by:</Text>
                {(['latest', 'popular'] as const).map((sort) => (
                  <Pressable
                    key={sort}
                    onPress={() => setTopicSort(sort)}
                    style={[
                      styles.sortPill,
                      topicSort === sort && { backgroundColor: colors.accentSubtle },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sortPillText,
                        { color: topicSort === sort ? colors.accent : colors.textMuted },
                      ]}
                    >
                      {sort === 'latest' ? 'Latest' : 'Popular'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Flat Underline Tab Row (Threads Signature) */}
        <View style={[styles.tabsBar, { borderBottomColor: colors.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScrollContent}
          >
            {(
              [
                { key: 'for_you', label: 'For You' },
                { key: 'news', label: 'Anime News' },
                { key: 'theories', label: 'Theories' },
                { key: 'recommendations', label: 'Recommendations' },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    setActiveTab(tab.key);
                    triggerHaptic();
                  }}
                  style={styles.tabButton}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${tab.label} tab`}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: isActive ? colors.text : colors.textMuted },
                      isActive && styles.tabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {isActive && <View style={[styles.tabUnderline, { backgroundColor: colors.text }]} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Start a Thread Quick Bar (Threads Signature Header Row) */}
        {activeTab !== 'news' && (
          <Pressable
            onPress={handleOpenCreateTopic}
            style={[styles.quickStartRow, { borderBottomColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Start a new thread"
          >
            <UserAvatar
              uri={myAvatarUrl}
              name={myDisplayName || 'User'}
              size={36}
              bgColor={colors.surfaceElevated}
              textColor={colors.accent}
            />
            <View style={styles.quickStartInput}>
              <Text style={[styles.quickStartPlaceholder, { color: colors.textMuted }]}>
                What&apos;s new in manga & anime?
              </Text>
            </View>
            <View style={styles.quickStartAction}>
              <Ionicons name="images-outline" size={19} color={colors.textMuted} />
            </View>
          </Pressable>
        )}

        {/* Feed Content */}
        {isLoading ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.feedListContainer}
          >
            {activeTab === 'news' ? (
              <>
                <AnimeNewsCardSkeleton />
                <AnimeNewsCardSkeleton />
                <AnimeNewsCardSkeleton />
                <AnimeNewsCardSkeleton />
              </>
            ) : (
              <>
                <ThreadCardSkeleton />
                <ThreadCardSkeleton withImage />
                <ThreadCardSkeleton />
                <ThreadCardSkeleton />
              </>
            )}
          </ScrollView>
        ) : activeTab === 'news' ? (
          /* Anime News ANN Feed in Threads Stream Aesthetic */
          <FlatList
            data={animeNews}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.feedListContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <AppRefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleOpenNews(item)}
                style={({ pressed }) => [
                  styles.threadPostRow,
                  { borderBottomColor: colors.border, opacity: pressed ? 0.88 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Read news: ${item.title}`}
              >
                {/* Left Column: Source Favicon Avatar + Connector */}
                <View style={styles.postLeftCol}>
                  <View style={[styles.newsAvatarWrap, { backgroundColor: colors.surfaceElevated }]}>
                    <Image
                      source={{ uri: getNewsSourceFavicon(item.source) }}
                      style={styles.newsFaviconImg}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={[styles.threadConnectorLine, { backgroundColor: colors.border }]} />
                </View>

                {/* Right Column: News Content */}
                <View style={styles.postRightCol}>
                  <View style={styles.postHeaderRow}>
                    <View style={styles.authorTitleRow}>
                      <Text style={[styles.authorName, { color: colors.text }]}>{item.source}</Text>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={item.source === 'Anime Corner' ? '#EF4444' : '#3B82F6'}
                        style={{ marginLeft: 3 }}
                      />
                    </View>
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>
                      {formatThreadTime(item.publishedAt)}
                    </Text>
                  </View>

                  <Text style={[styles.newsHeadlineText, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>

                  <Text style={[styles.threadBodyText, { color: colors.textSecondary }]} numberOfLines={3}>
                    {item.summary}
                  </Text>

                  {item.imageUrl || item.images?.[0] ? (
                    <Image
                      source={{ uri: (item.imageUrl || item.images?.[0]) as string }}
                      style={styles.newsPostCover}
                      resizeMode="cover"
                    />
                  ) : null}

                  <View style={styles.newsSourceRow}>
                    <Ionicons name="open-outline" size={13} color={colors.accent} />
                    <Text style={[styles.newsSourceText, { color: colors.accent }]}>Read on {item.source}</Text>
                  </View>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No news articles available</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  Pull down to refresh and fetch the latest updates.
                </Text>
              </View>
            }
          />
        ) : (
          /* Threads Feed List */
          <FlatList
            data={filteredThreads}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.feedListContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <AppRefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            }
            renderItem={({ item }) => {
              const isLiked = likedThreadIds.has(item.id);
              const isReposted = repostedThreadIds.has(item.id);
              const avatarUri = resolvePostAvatar(
                item.authorAvatarUrl,
                item.author,
                myDisplayName,
                myAvatarUrl,
                dbAvatars[item.author]
              );
              const hasReplies = item.repliesCount > 0;

              return (
                <Pressable
                  onPress={() => handleOpenThread(item)}
                  style={({ pressed }) => [
                    styles.threadPostRow,
                    { borderBottomColor: colors.border, opacity: pressed ? 0.92 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Thread by ${item.author}`}
                >
                  {/* Left Column: Author Avatar + Vertical Connector */}
                  <View style={styles.postLeftCol}>
                    <UserAvatar
                      uri={avatarUri}
                      name={item.author}
                      size={38}
                      bgColor={colors.surfaceElevated}
                      textColor={colors.accent}
                    />
                    {hasReplies ? (
                      <>
                        <View style={[styles.threadConnectorLine, { backgroundColor: colors.border }]} />
                        <View style={[styles.replyMiniAvatarWrap, { backgroundColor: colors.surfaceElevated }]}>
                          <Ionicons name="chatbubble" size={10} color={colors.textMuted} />
                        </View>
                      </>
                    ) : null}
                  </View>

                  {/* Right Column: Author, Time, Body, Attachments & 4-Action Row */}
                  <View style={styles.postRightCol}>
                    {/* Header: Author + Timestamp + Menu */}
                    <View style={styles.postHeaderRow}>
                      <View style={styles.authorTitleRow}>
                        <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                          {item.author}
                        </Text>
                        {item.category && item.category !== 'Discussion' && (
                          <View style={[styles.categoryTag, { backgroundColor: colors.accentSubtle }]}>
                            <Text style={[styles.categoryTagText, { color: colors.accent }]}>
                              {item.category}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.postHeaderMeta}>
                        <Text style={[styles.timeText, { color: colors.textMuted }]}>
                          {formatThreadTime(item.createdAt)}
                        </Text>
                        {user && (item.author === myDisplayName || item.id.startsWith('custom_')) && (
                          <Pressable
                            onPress={() => handleDeleteTopic(item.id)}
                            hitSlop={8}
                            style={styles.moreActionBtn}
                            accessibilityLabel="Delete topic"
                          >
                            <Ionicons name="trash-outline" size={15} color="#EF4444" />
                          </Pressable>
                        )}
                      </View>
                    </View>

                    {/* Thread Headline Title (if distinct from body) */}
                    {item.title && item.title !== item.body && (
                      <Text style={[styles.threadTitleText, { color: colors.text }]}>{item.title}</Text>
                    )}

                    {/* Thread Body with @mentions */}
                    <MentionText
                      body={item.body || item.title}
                      textColor={colors.textSecondary}
                      accentColor={colors.accent}
                    />

                    {/* Attached Photos */}
                    {item.imageUrls && item.imageUrls.length > 0 && (
                      <View style={styles.threadMediaContainer}>
                        {item.imageUrls.length === 1 ? (
                          <Image
                            source={{ uri: item.imageUrls[0] }}
                            style={styles.threadSingleImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.mediaGalleryScroll}
                          >
                            {item.imageUrls.map((uri, idx) => (
                              <Image
                                key={`${uri}-${idx}`}
                                source={{ uri }}
                                style={styles.threadGalleryImage}
                                resizeMode="cover"
                              />
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    )}

                    {/* Signature 4-Action Row (Like, Reply, Repost, Share) */}
                    <View style={styles.actionRow}>
                      <AnimatedPressable
                        onPress={() => handleToggleLikeThread(item.id)}
                        style={styles.actionBtn}
                        scaleTo={0.9}
                        accessibilityLabel="Like thread"
                      >
                        <Ionicons
                          name={isLiked ? 'heart' : 'heart-outline'}
                          size={19}
                          color={isLiked ? '#EF4444' : colors.textMuted}
                        />
                      </AnimatedPressable>

                      <AnimatedPressable
                        onPress={() => handleOpenThread(item)}
                        style={styles.actionBtn}
                        scaleTo={0.9}
                        accessibilityLabel="Reply to thread"
                      >
                        <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
                      </AnimatedPressable>

                      <AnimatedPressable
                        onPress={() => handleToggleRepostThread(item.id)}
                        style={styles.actionBtn}
                        scaleTo={0.9}
                        accessibilityLabel="Repost thread"
                      >
                        <Ionicons
                          name="repeat-outline"
                          size={20}
                          color={isReposted ? '#10B981' : colors.textMuted}
                        />
                      </AnimatedPressable>

                      <AnimatedPressable
                        onPress={() => handleShareThread(item)}
                        style={styles.actionBtn}
                        scaleTo={0.9}
                        accessibilityLabel="Share thread"
                      >
                        <Ionicons name="paper-plane-outline" size={18} color={colors.textMuted} />
                      </AnimatedPressable>
                    </View>

                    {/* Threads Activity Counter Subtext */}
                    <View style={styles.activityMetaRow}>
                      <Text style={[styles.activityMetaText, { color: colors.textMuted }]}>
                        {item.repliesCount} {item.repliesCount === 1 ? 'reply' : 'replies'}
                        {isLiked ? ' · 1 like' : ''}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No discussions found</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  {searchQuery.trim()
                    ? `No topics match "${searchQuery}". Try a different keyword.`
                    : 'Be the first to start a conversation in this feed!'}
                </Text>
              </View>
            }
          />
        )}

        {/* Full-Bleed Thread Discussion Sheet / Conversation View */}
        <Modal
          visible={!!selectedThread}
          transparent={false}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setSelectedThread(null)}
          statusBarTranslucent
        >
          <SafeAreaView
            style={[styles.discussionContainer, { backgroundColor: colors.background }]}
            edges={['top', 'bottom']}
          >
            {/* Top Navigation */}
            <View style={[styles.discussionTopBar, { borderBottomColor: colors.border }]}>
              <AnimatedPressable
                onPress={() => setSelectedThread(null)}
                style={styles.topBarBackBtn}
                scaleTo={0.92}
                accessibilityLabel="Back to feed"
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </AnimatedPressable>

              <Text style={[styles.discussionTopTitle, { color: colors.text }]}>Thread</Text>

              <View style={styles.topBarRightSlot}>
                {user && (selectedThread?.author === myDisplayName || selectedThread?.id?.startsWith('custom_')) && (
                  <AnimatedPressable
                    onPress={() => selectedThread && handleDeleteTopic(selectedThread.id)}
                    style={styles.topBarBackBtn}
                    scaleTo={0.92}
                    accessibilityLabel="Delete thread"
                    accessibilityRole="button"
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </AnimatedPressable>
                )}
              </View>
            </View>

            {/* Scrollable Conversation Content */}
            <ScrollView
              contentContainerStyle={styles.discussionScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedThread && (
                <View style={[styles.expandedParentPost, { borderBottomColor: colors.border }]}>
                  {/* Parent Author Row */}
                  <View style={styles.parentAuthorRow}>
                    <UserAvatar
                      uri={resolvePostAvatar(
                        selectedThread.authorAvatarUrl,
                        selectedThread.author,
                        myDisplayName,
                        myAvatarUrl,
                        dbAvatars[selectedThread.author]
                      )}
                      name={selectedThread.author}
                      size={44}
                      bgColor={colors.surfaceElevated}
                      textColor={colors.accent}
                    />
                    <View style={styles.parentAuthorMeta}>
                      <Text style={[styles.parentAuthorName, { color: colors.text }]}>
                        {selectedThread.author}
                      </Text>
                      {selectedThread.category && selectedThread.category !== 'Discussion' && (
                        <View style={[styles.categoryTag, { backgroundColor: colors.accentSubtle }]}>
                          <Text style={[styles.categoryTagText, { color: colors.accent }]}>
                            {selectedThread.category}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Parent Title & Body */}
                  {selectedThread.title && (
                    <Text style={[styles.parentTitleText, { color: colors.text }]}>
                      {selectedThread.title}
                    </Text>
                  )}
                  <MentionText
                    body={selectedThread.body || selectedThread.title}
                    textColor={colors.text}
                    accentColor={colors.accent}
                    fontSize={17}
                    lineHeight={24}
                  />

                  {/* Attached Images */}
                  {selectedThread.imageUrls && selectedThread.imageUrls.length > 0 && (
                    <View style={styles.parentMediaContainer}>
                      {selectedThread.imageUrls.map((uri, idx) => (
                        <Image
                          key={`${uri}-${idx}`}
                          source={{ uri }}
                          style={styles.parentMediaImage}
                          resizeMode="cover"
                        />
                      ))}
                    </View>
                  )}

                  {/* Full Timestamp */}
                  <Text style={[styles.parentFullDate, { color: colors.textMuted }]}>
                    {formatFullThreadTime(selectedThread.createdAt)}
                  </Text>

                  {/* Parent Action Row */}
                  <View style={[styles.parentActionRow, { borderTopColor: colors.border }]}>
                    <AnimatedPressable
                      onPress={() => handleToggleLikeThread(selectedThread.id)}
                      style={styles.actionBtn}
                      scaleTo={0.9}
                      accessibilityLabel="Like thread"
                    >
                      <Ionicons
                        name={likedThreadIds.has(selectedThread.id) ? 'heart' : 'heart-outline'}
                        size={21}
                        color={likedThreadIds.has(selectedThread.id) ? '#EF4444' : colors.textMuted}
                      />
                    </AnimatedPressable>

                    <AnimatedPressable
                      onPress={() => replyInputRef.current?.focus()}
                      style={styles.actionBtn}
                      scaleTo={0.9}
                      accessibilityLabel="Reply to thread"
                    >
                      <Ionicons name="chatbubble-outline" size={20} color={colors.textMuted} />
                    </AnimatedPressable>

                    <AnimatedPressable
                      onPress={() => handleToggleRepostThread(selectedThread.id)}
                      style={styles.actionBtn}
                      scaleTo={0.9}
                      accessibilityLabel="Repost thread"
                    >
                      <Ionicons
                        name="repeat-outline"
                        size={22}
                        color={repostedThreadIds.has(selectedThread.id) ? '#10B981' : colors.textMuted}
                      />
                    </AnimatedPressable>

                    <AnimatedPressable
                      onPress={() => handleShareThread(selectedThread)}
                      style={styles.actionBtn}
                      scaleTo={0.9}
                      accessibilityLabel="Share thread"
                    >
                      <Ionicons name="paper-plane-outline" size={20} color={colors.textMuted} />
                    </AnimatedPressable>
                  </View>
                </View>
              )}

              {/* Replies Section with Continuous Connector */}
              <View style={styles.repliesStream}>
                {isRepliesLoading ? (
                  <View style={{ paddingVertical: 4 }}>
                    <ThreadReplySkeleton />
                    <ThreadReplySkeleton />
                    <ThreadReplySkeleton />
                  </View>
                ) : replies.length === 0 ? (
                  <View style={styles.emptyRepliesWrap}>
                    <Text style={[styles.emptyRepliesTitle, { color: colors.textMuted }]}>
                      No replies yet. Be the first to start the thread.
                    </Text>
                  </View>
                ) : (
                  replies.map((reply, idx) => {
                    const isLast = idx === replies.length - 1;
                    const avatarUri = resolvePostAvatar(
                      reply.avatarUrl,
                      reply.username,
                      myDisplayName,
                      myAvatarUrl,
                      dbAvatars[reply.username]
                    );

                    return (
                      <View
                        key={reply.id}
                        style={[
                          styles.replyItemRow,
                          { borderBottomColor: isLast ? 'transparent' : colors.border },
                        ]}
                      >
                        {/* Left column: Avatar + continuous vertical line */}
                        <View style={styles.postLeftCol}>
                          <UserAvatar
                            uri={avatarUri}
                            name={reply.username}
                            size={34}
                            bgColor={colors.surfaceElevated}
                            textColor={colors.accent}
                          />
                          {!isLast && (
                            <View style={[styles.threadConnectorLine, { backgroundColor: colors.border }]} />
                          )}
                        </View>

                        {/* Right column: Content */}
                        <View style={styles.postRightCol}>
                          <View style={styles.postHeaderRow}>
                            <Text style={[styles.authorName, { color: colors.text }]}>
                              {reply.username}
                            </Text>
                            <View style={styles.postHeaderMeta}>
                              <Text style={[styles.timeText, { color: colors.textMuted }]}>
                                {formatThreadTime(reply.postedAt)}
                              </Text>
                              {user && (reply.username === myDisplayName || reply.id.startsWith('reply_')) && (
                                <Pressable
                                  onPress={() => handleDeleteReply(reply.id)}
                                  hitSlop={8}
                                  accessibilityLabel="Delete reply"
                                >
                                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                </Pressable>
                              )}
                            </View>
                          </View>

                          {reply.replyTo && (
                            <Text style={[styles.replyingToHeader, { color: colors.accent }]}>
                              Replying to @{reply.replyTo}
                            </Text>
                          )}

                          <MentionText
                            body={reply.body}
                            textColor={colors.textSecondary}
                            accentColor={colors.accent}
                          />

                          {reply.imageUrls && reply.imageUrls.length > 0 && (
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.mediaGalleryScroll}
                            >
                              {reply.imageUrls.map((uri, i) => (
                                <Image
                                  key={`${uri}-${i}`}
                                  source={{ uri }}
                                  style={styles.replyGalleryImage}
                                  resizeMode="cover"
                                />
                              ))}
                            </ScrollView>
                          )}

                          <View style={styles.replyActionRow}>
                            <Pressable
                              onPress={() => {
                                triggerHaptic();
                                setLikedReplyIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(reply.id)) next.delete(reply.id);
                                  else next.add(reply.id);
                                  return next;
                                });
                              }}
                              hitSlop={6}
                              style={styles.actionBtn}
                              accessibilityLabel="Like reply"
                            >
                              <Ionicons
                                name={likedReplyIds.has(reply.id) ? 'heart' : 'heart-outline'}
                                size={16}
                                color={likedReplyIds.has(reply.id) ? '#EF4444' : colors.textMuted}
                              />
                            </Pressable>

                            {reply.username !== myDisplayName && (
                              <Pressable
                                onPress={() => handleMentionUser(reply.username)}
                                hitSlop={6}
                                style={styles.actionBtn}
                                accessibilityLabel={`Reply to ${reply.username}`}
                              >
                                <Ionicons name="chatbubble-outline" size={15} color={colors.textMuted} />
                              </Pressable>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>

            {/* Docked Reply Composer Bar */}
            <View style={[styles.dockedComposer, { backgroundColor: colors.surfaceElevated, borderTopColor: colors.border }]}>
              {replyTo && (
                <View style={styles.replyTargetBar}>
                  <Text style={[styles.replyTargetText, { color: colors.textMuted }]}>
                    Replying to <Text style={{ color: colors.accent, fontWeight: '700' }}>@{replyTo}</Text>
                  </Text>
                  <Pressable onPress={() => setReplyTo(null)} hitSlop={8} accessibilityLabel="Clear reply mention">
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}

              {replyImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.composerThumbsRow}>
                  {replyImages.map((uri) => (
                    <View key={uri} style={styles.composerThumbWrap}>
                      <Image source={{ uri }} style={styles.composerThumb} resizeMode="cover" />
                      <Pressable
                        onPress={() => setReplyImages((prev) => prev.filter((u) => u !== uri))}
                        hitSlop={6}
                        style={styles.composerThumbRemove}
                        accessibilityLabel="Remove photo"
                      >
                        <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={styles.dockedInputRow}>
                <UserAvatar
                  uri={myAvatarUrl}
                  name={myDisplayName || 'User'}
                  size={32}
                  bgColor={colors.surface}
                  textColor={colors.accent}
                />
                <TextInput
                  ref={replyInputRef}
                  style={[styles.dockedTextInput, { color: colors.text }]}
                  placeholder={`Reply to ${selectedThread?.author || 'thread'}…`}
                  placeholderTextColor={colors.textMuted}
                  value={newReplyText}
                  onChangeText={setNewReplyText}
                  multiline
                />
                <Pressable
                  onPress={async () => {
                    const picked = await pickCommunityImages(replyImages, (errMsg) => {
                      setConfirmModalConfig({
                        visible: true,
                        title: 'File Size Limit',
                        message: errMsg,
                        iconName: 'alert-circle-outline',
                        confirmText: 'OK',
                        cancelText: '',
                        confirmVariant: 'primary',
                        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
                      });
                    });
                    setReplyImages(picked);
                  }}
                  hitSlop={8}
                  style={styles.dockedAttachBtn}
                  accessibilityLabel="Attach photo to reply"
                >
                  <Ionicons
                    name="images-outline"
                    size={20}
                    color={replyImages.length > 0 ? colors.accent : colors.textMuted}
                  />
                </Pressable>
                <AnimatedPressable
                  onPress={handleSendReply}
                  disabled={isSendingReply || (!newReplyText.trim() && replyImages.length === 0)}
                  style={[
                    styles.dockedSendBtn,
                    {
                      backgroundColor: colors.text,
                      opacity: isSendingReply ? 0.6 : (newReplyText.trim() || replyImages.length > 0 ? 1 : 0.35),
                    },
                  ]}
                  scaleTo={0.92}
                  accessibilityRole="button"
                  accessibilityLabel="Send reply"
                >
                  {isSendingReply ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Ionicons name="arrow-up" size={18} color={colors.background} />
                  )}
                </AnimatedPressable>
              </View>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Create New Thread Modal (Threads Signature Composer) */}
        <Modal
          visible={showCreateModal}
          transparent={false}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCreateModal(false)}
          statusBarTranslucent
        >
          <SafeAreaView style={[styles.createSheetContainer, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            {/* Sheet Top Bar */}
            <View style={[styles.createSheetTopBar, { borderBottomColor: colors.border }]}>
              <Pressable
                onPress={() => setShowCreateModal(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Cancel thread creation"
              >
                <Text style={[styles.createCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>

              <Text style={[styles.createHeaderTitle, { color: colors.text }]}>New thread</Text>

              <AnimatedPressable
                onPress={handleCreateTopic}
                disabled={isPostingTopic || (!topicTitle.trim() && !topicBody.trim() && topicImages.length === 0)}
                style={[
                  styles.createPostBtn,
                  {
                    backgroundColor: colors.text,
                    opacity: isPostingTopic ? 0.6 : (topicTitle.trim() || topicBody.trim() || topicImages.length > 0 ? 1 : 0.35),
                  },
                ]}
                scaleTo={0.94}
                accessibilityRole="button"
                accessibilityLabel="Post thread"
              >
                {isPostingTopic ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={[styles.createPostBtnText, { color: colors.background }]}>Post</Text>
                )}
              </AnimatedPressable>
            </View>

            <ScrollView contentContainerStyle={styles.createSheetBody} showsVerticalScrollIndicator={false}>
              {/* Category Selection Chips */}
              <View style={styles.categoryPillRow}>
                {(['Discussion', 'Theories', 'Recommendations'] as const).map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setTopicCategory(cat)}
                    style={[
                      styles.categoryChoicePill,
                      { backgroundColor: colors.surfaceElevated },
                      topicCategory === cat && { backgroundColor: colors.accentSubtle },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChoiceText,
                        { color: topicCategory === cat ? colors.accent : colors.textMuted },
                        topicCategory === cat && { fontWeight: '700' },
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Main Composer 2-Column Row */}
              <View style={styles.composerMainRow}>
                {/* Left Column: Avatar + vertical thread line */}
                <View style={styles.postLeftCol}>
                  <UserAvatar
                    uri={myAvatarUrl}
                    name={myDisplayName || 'User'}
                    size={38}
                    bgColor={colors.surfaceElevated}
                    textColor={colors.accent}
                  />
                  <View style={[styles.threadConnectorLine, { backgroundColor: colors.border }]} />
                </View>

                {/* Right Column: Inputs */}
                <View style={styles.postRightCol}>
                  <Text style={[styles.authorName, { color: colors.text }]}>
                    {myDisplayName || 'You'}
                  </Text>

                  <TextInput
                    style={[styles.createTitleInput, { color: colors.text }]}
                    placeholder="Title (optional)"
                    placeholderTextColor={colors.textMuted}
                    value={topicTitle}
                    onChangeText={setTopicTitle}
                  />

                  <TextInput
                    style={[styles.createBodyInput, { color: colors.text }]}
                    placeholder="Start a thread…"
                    placeholderTextColor={colors.textMuted}
                    value={topicBody}
                    onChangeText={setTopicBody}
                    multiline
                    autoFocus
                  />

                  {/* Attached images preview */}
                  {topicImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.composerThumbsRow}>
                      {topicImages.map((uri) => (
                        <View key={uri} style={styles.composerThumbWrap}>
                          <Image source={{ uri }} style={styles.composerThumb} resizeMode="cover" />
                          <Pressable
                            onPress={() => setTopicImages((prev) => prev.filter((u) => u !== uri))}
                            hitSlop={6}
                            style={styles.composerThumbRemove}
                            accessibilityLabel="Remove photo"
                          >
                            <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {/* Action icons bar */}
                  <View style={styles.composerActionRow}>
                    <Pressable
                      onPress={async () => {
                        const picked = await pickCommunityImages(topicImages, (errMsg) => {
                          setConfirmModalConfig({
                            visible: true,
                            title: 'File Size Limit',
                            message: errMsg,
                            iconName: 'alert-circle-outline',
                            confirmText: 'OK',
                            cancelText: '',
                            confirmVariant: 'primary',
                            onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
                          });
                        });
                        setTopicImages(picked);
                      }}
                      hitSlop={8}
                      accessibilityLabel="Attach photos"
                    >
                      <Ionicons
                        name="images-outline"
                        size={22}
                        color={topicImages.length > 0 ? colors.accent : colors.textMuted}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Anime News Full Article Modal */}
        <Modal
          visible={!!selectedNews}
          transparent={isWeb}
          animationType={isWeb ? 'fade' : 'slide'}
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={() => setSelectedNews(null)}
        >
          <View style={[styles.newsModalBackdrop, !isWeb && styles.newsModalBackdropMobile]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedNews(null)} />
            <View
              style={[
                styles.newsModalSheet,
                isWeb ? styles.newsModalSheetWeb : styles.newsModalSheetMobile,
                { backgroundColor: colors.surface },
              ]}
            >
              {/* News Sheet Header */}
              <SafeAreaView
                edges={['top']}
                style={[
                  styles.newsModalTopBarSafe,
                  { backgroundColor: colors.surface },
                ]}
              >
                <View style={styles.newsModalTopBar}>
                  <Pressable
                    onPress={() => setSelectedNews(null)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.newsBackButton, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Back to news"
                    aria-label="Back to news"
                  >
                    <Ionicons name="arrow-back" size={26} color={colors.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => selectedNews && WebBrowser.openBrowserAsync(selectedNews.url)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.newsBackButton, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Open in browser"
                    aria-label="Open in browser"
                  >
                    <Ionicons name="open-outline" size={22} color={colors.text} />
                  </Pressable>
                </View>
              </SafeAreaView>

              <ScrollView
                style={styles.newsModalScrollView}
                contentContainerStyle={styles.newsModalContent}
                showsVerticalScrollIndicator={false}
              >
                {(selectedNews?.imageUrl || selectedNews?.images?.[0]) ? (
                  <Pressable
                    onPress={() => setFullscreenImageUri(selectedNews?.imageUrl || selectedNews?.images?.[0] || null)}
                    style={styles.newsHeroWrap}
                    accessibilityRole="button"
                    accessibilityLabel="View full cover visual"
                  >
                    <Image
                      source={{ uri: (selectedNews?.imageUrl || selectedNews?.images?.[0]) as string }}
                      style={styles.newsArticleHero}
                      resizeMode="cover"
                    />
                  </Pressable>
                ) : null}

                <View style={styles.newsArticleMetaRow}>
                  <View style={styles.newsModalSourceBadge}>
                    <Image
                      source={{ uri: getNewsSourceFavicon(selectedNews?.source) }}
                      style={styles.newsModalFavicon}
                      resizeMode="contain"
                    />
                    <Text style={[styles.categoryTagText, { color: colors.accent }]}>
                      {selectedNews?.source || 'Anime News'}
                    </Text>
                  </View>
                  <Text style={[styles.timeText, { color: colors.textMuted }]}>
                    {selectedNews ? formatChapterDate(selectedNews.publishedAt) : ''}
                  </Text>
                </View>

                <Text style={[styles.newsArticleFullTitle, { color: colors.text }]}>{selectedNews?.title}</Text>
                {shouldShowNewsSummary ? (
                  <Text style={[styles.newsArticleSummaryText, { color: colors.textSecondary }]}>
                    {selectedNews?.summary}
                  </Text>
                ) : null}

                {/* Official Visuals & Key Art Large Gallery */}
                {galleryVisuals.length > 0 && (
                  <View style={styles.newsGalleryContainer}>
                    <View style={styles.newsGalleryHeader}>
                      <View style={styles.newsGalleryTitleRow}>
                        <Ionicons name="images-outline" size={17} color={colors.accent} />
                        <Text style={[styles.newsGalleryTitle, { color: colors.text }]}>
                          Official Visuals & Key Art
                        </Text>
                      </View>
                      <Text style={[styles.timeText, { color: colors.textMuted }]}>
                        {galleryVisuals.length} visuals
                      </Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.newsGalleryScroll}
                    >
                      {galleryVisuals.map((imgUri, idx) => (
                        <NewsGalleryVisualCard
                          key={`${imgUri}-${idx}`}
                          uri={imgUri}
                          index={idx}
                          onPress={() => setFullscreenImageUri(imgUri)}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}

                {isNewsArticleLoading ? (
                  <AnimeNewsArticleSkeleton />
                ) : (
                  articleParagraphs.map((paragraph, index) => (
                    <FormattedNewsParagraph
                      key={`${selectedNews?.url}-${index}`}
                      paragraph={paragraph}
                      colors={colors}
                    />
                  ))
                )}

                {(selectedNews?.trailerUrls?.length || selectedNews?.trailerUrl) && (
                  <View style={styles.newsTrailerBlock}>
                    <Text style={[styles.newsTrailerHeading, { color: colors.text }]}>Video Trailer</Text>
                    {(selectedNews.trailerUrls || [selectedNews.trailerUrl])
                      .filter((url): url is string => Boolean(url))
                      .map((trailerUrl, index) => {
                        const embedUrl = getYomiteTrailerEmbedUrl(trailerUrl);
                        return isWeb ? (
                          React.createElement('iframe', {
                            key: embedUrl,
                            src: embedUrl,
                            title: `${selectedNews?.title} trailer ${index + 1}`,
                            style: { width: '100%', height: 210, border: 0, borderRadius: 12, marginBottom: 8 },
                            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                            allowFullScreen: true,
                          })
                        ) : (
                          <WebView
                            key={embedUrl}
                            source={{ uri: embedUrl, headers: { Referer: 'https://yomite.vercel.app/' } }}
                            style={styles.newsTrailerWebView}
                            javaScriptEnabled
                            allowsFullscreenVideo
                            allowsInlineMediaPlayback
                            mediaPlaybackRequiresUserAction
                          />
                        );
                      })}
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Full-Screen Visual Lightbox Overlay (Inside News Modal) */}
            {fullscreenImageUri ? (
              <View style={styles.newsLightboxOverlay}>
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => setFullscreenImageUri(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close full screen visual"
                />
                <SafeAreaView style={styles.newsLightboxTopBar} pointerEvents="box-none">
                  <Pressable
                    onPress={() => setFullscreenImageUri(null)}
                    style={styles.newsLightboxCloseBtn}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Close visual"
                  >
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </Pressable>
                </SafeAreaView>

                <View style={styles.newsLightboxCenterWrap} pointerEvents="box-none">
                  <ZoomableImage
                    source={{ uri: fullscreenImageUri }}
                    style={{
                      width: Math.min(screenWidth * 0.94, 850),
                      height: Math.min(screenHeight * 0.85, 950),
                    }}
                    contentFit="contain"
                    onTap={() => setFullscreenImageUri(null)}
                  />
                </View>
              </View>
            ) : null}
          </View>
        </Modal>

        {/* Global Components: Modals & Drawer */}
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
        <ConfirmationModal
          visible={confirmModalConfig.visible}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          iconName={confirmModalConfig.iconName || 'alert-circle-outline'}
          confirmVariant={confirmModalConfig.confirmVariant || 'primary'}
          confirmText={confirmModalConfig.confirmText || 'OK'}
          cancelText={confirmModalConfig.cancelText}
          onConfirm={confirmModalConfig.onConfirm}
          onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, visible: false }))}
        />
        <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webFeedCenter: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },

  /* Threads Top Header */
  threadsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'web' ? Spacing.md : Spacing.xs,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBrandTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerComposeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: Radius.full,
  },
  headerComposeText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: '700',
  },

  /* Search Drawer */
  searchDrawer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    height: 40,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  sortToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingLeft: 4,
  },
  sortSubLabel: {
    fontSize: Typography.sizes.caption,
  },
  sortPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  sortPillText: {
    fontSize: Typography.sizes.caption,
    fontWeight: '600',
  },

  /* Flat Underline Tabs (Threads Signature) */
  tabsBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabsScrollContent: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
  },
  tabButton: {
    paddingVertical: 14,
    marginRight: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  tabTextActive: {
    fontWeight: '800',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },

  /* Start a Thread Quick Bar */
  quickStartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  quickStartInput: {
    flex: 1,
  },
  quickStartPlaceholder: {
    fontSize: 15,
  },
  quickStartAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Center Loading */
  centerLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: Typography.sizes.footnote,
  },

  /* Feed Stream Layout */
  feedListContainer: {
    paddingBottom: 120,
  },
  threadPostRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postLeftCol: {
    width: 40,
    alignItems: 'center',
  },
  threadConnectorLine: {
    width: 1.5,
    flex: 1,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 1,
  },
  replyMiniAvatarWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postRightCol: {
    flex: 1,
    marginLeft: 12,
    gap: 4,
  },
  postHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  postHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timeText: {
    fontSize: 13,
  },
  moreActionBtn: {
    padding: 2,
  },
  threadTitleText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 2,
  },
  threadBodyText: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.1,
  },

  /* Media Attachment Previews */
  threadMediaContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  threadSingleImage: {
    width: '100%',
    height: 240,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mediaGalleryScroll: {
    gap: 8,
  },
  threadGalleryImage: {
    width: 220,
    height: 220,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  replyGalleryImage: {
    width: 150,
    height: 150,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  /* Signature 4-Action Row (Like, Reply, Repost, Share) */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
    marginBottom: 2,
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityMetaRow: {
    marginTop: 2,
  },
  activityMetaText: {
    fontSize: 13,
  },

  /* Anime News Items */
  newsAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  newsFaviconImg: {
    width: 24,
    height: 24,
    borderRadius: 5,
  },
  newsModalSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newsModalFavicon: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  newsHeadlineText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 2,
  },
  newsPostCover: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    marginTop: 6,
  },
  newsSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  newsSourceText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Discussion Full-Bleed Sheet */
  discussionContainer: {
    flex: 1,
  },
  discussionTopBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussionTopTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  topBarRightSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discussionScrollContent: {
    paddingBottom: 40,
  },
  expandedParentPost: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  parentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  parentAuthorMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  parentAuthorName: {
    fontSize: 16,
    fontWeight: '700',
  },
  parentTitleText: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  parentMediaContainer: {
    gap: 8,
    marginTop: 6,
  },
  parentMediaImage: {
    width: '100%',
    height: 260,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  parentFullDate: {
    fontSize: 13,
    marginTop: 4,
  },
  parentActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  /* Replies in Discussion */
  repliesStream: {
    paddingVertical: Spacing.sm,
  },
  replyItemRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyingToHeader: {
    fontSize: 12,
    fontWeight: '600',
  },
  replyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  emptyRepliesWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: Spacing.xl,
  },
  emptyRepliesTitle: {
    fontSize: 14,
    textAlign: 'center',
  },

  /* Docked Composer */
  dockedComposer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  replyTargetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  replyTargetText: {
    fontSize: 12,
  },
  dockedInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  dockedTextInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
  },
  dockedAttachBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockedSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerThumbsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  composerThumbWrap: {
    position: 'relative',
  },
  composerThumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
  },
  composerThumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
  },

  /* Create Sheet Composer */
  createSheetContainer: {
    flex: 1,
  },
  createSheetTopBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  createCancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  createHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  createPostBtn: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPostBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  createSheetBody: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  categoryPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChoicePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  categoryChoiceText: {
    fontSize: 13,
  },
  composerMainRow: {
    flexDirection: 'row',
  },
  createTitleInput: {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 6,
  },
  createBodyInput: {
    fontSize: 16,
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: 'top',
    paddingVertical: 4,
  },
  composerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },

  /* Anime News Modal */
  newsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsModalBackdropMobile: {
    padding: 0,
  },
  newsModalSheet: {
    width: '100%',
    overflow: 'hidden',
  },
  newsModalSheetWeb: {
    maxWidth: 700,
    maxHeight: '85vh' as any,
    borderRadius: Radius.lg,
  },
  newsModalSheetMobile: {
    flex: 1,
  },
  newsModalTopBarSafe: {
    zIndex: 20,
    elevation: 4,
  },
  newsModalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 6,
    paddingBottom: 8,
  },
  newsBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsModalScrollView: {
    flex: 1,
  },
  newsModalContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: Spacing.md,
    paddingBottom: 60,
  },
  newsArticleHero: {
    width: '100%',
    height: 220,
    borderRadius: Radius.md,
  },
  newsArticleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsArticleFullTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  newsArticleSummaryText: {
    fontSize: 15,
    lineHeight: 22,
  },
  newsLoadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  newsHeroWrap: {
    width: '100%',
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  newsHeadingWrap: {
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  newsSectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  newsBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
    marginVertical: 2,
  },
  newsBulletDot: {
    fontSize: 16,
    marginRight: 8,
    lineHeight: 22,
    fontWeight: '700',
  },
  newsBulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  newsActorName: {
    fontWeight: '700',
  },
  newsCharacterName: {
    fontWeight: '700',
  },
  newsRoleTitle: {
    fontWeight: '700',
  },
  newsQuoteBox: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  newsQuoteText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  newsGalleryContainer: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  newsGalleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  newsGalleryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newsGalleryTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  newsGalleryScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
    paddingRight: Spacing.md,
  },
  newsGalleryCardDynamic: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  newsGalleryThumbDynamic: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.lg,
  },
  newsLightboxOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.97)',
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsLightboxTopBar: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 40,
    right: 16,
    zIndex: 100000,
  },
  newsLightboxCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsLightboxCenterWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  newsParagraph: {
    fontSize: 15,
    lineHeight: 24,
  },
  newsTrailerBlock: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  newsTrailerHeading: {
    fontSize: 17,
    fontWeight: '700',
  },
  newsTrailerWebView: {
    width: '100%',
    height: 210,
    borderRadius: Radius.md,
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: Typography.sizes.caption,
    textAlign: 'center',
    maxWidth: 300,
  },
});
