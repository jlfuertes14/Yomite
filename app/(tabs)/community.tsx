/**
 * Community Forums Screen — Modern Web & Mobile Responsive Community Board
 * Features rich category tabs, live thread discussions, responsive web grid layout,
 * centered web dialog modals, and hidden scrollbars.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import {
  getAnimeNews,
  getAnimeNewsArticle,
  getThreadReplies,
  fetchAuthorAvatarMap,
  mergeNewsCoversIntoFeedCache,
  ForumThread,
  ForumComment,
  AnimeNewsItem,
  AnimeNewsArticle,
} from '../../src/api/community';
import { useCommunityStore } from '../../src/store/communityStore';
import { useUserStore, getUserDisplayName, getUserAvatarUrl } from '../../src/store/userStore';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { formatChapterDate } from '../../src/utils/date';

import { AnimatedCard } from '../../src/components/AnimatedCard';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { AuthModal } from '../../src/components/AuthModal';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';
import * as WebBrowser from 'expo-web-browser';

const MAX_UPLOAD_IMAGES = 4;

/**
 * Opens the system photo library and returns the selected image URIs,
 * appended after any already-attached ones (capped at MAX_UPLOAD_IMAGES).
 */
async function pickCommunityImages(existing: string[]): Promise<string[]> {
  const remaining = MAX_UPLOAD_IMAGES - existing.length;
  if (remaining <= 0) return existing;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 0.7,
  });
  if (result.canceled) return existing;
  const uris = result.assets.map((a) => a.uri).filter(Boolean);
  return [...existing, ...uris].slice(0, MAX_UPLOAD_IMAGES);
}

/**
 * Renders reply/topic body text with @mentions highlighted in accent color.
 */
function MentionText({ body, textColor, accentColor }: { body: string; textColor: string; accentColor: string }) {
  const parts = body.split(/(@[\w.]+)/g);
  return (
    <Text style={[styles.replyBody, { color: textColor }]}>
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

/**
 * Real user photo with letter fallback. Shows the user's actual profile
 * image when one is available, otherwise the initial-letter avatar.
 */
/**
 * Guest/unsigned-in fallback identities never get a photo — letter avatar only,
 * even if a stale avatar URL was persisted from an earlier session.
 */
function isAnonymousIdentity(name?: string | null): boolean {
  if (!name) return true;
  return /^(guest|anonymous reader|yomite reader|mangadex reader)$/i.test(name.trim());
}

/**
 * Resolves which avatar URI (if any) a post is allowed to show:
 * stored photo → current user's live photo (own older posts) — never for anonymous names.
 */
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

function UserAvatar({
  uri,
  name,
  size,
  bgColor,
  textColor,
}: {
  uri?: string | null;
  name: string;
  size: number;
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
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: textColor, fontSize: size * 0.5, fontWeight: '700' }}>
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

export default function CommunityScreen() {
  useDocumentTitle('Community');
  const colors = useThemeColors();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const user = useUserStore((s) => s.user);

  const {
    userThreads,
    threadReplies,
    createThread,
    deleteThread,
    addReply,
    deleteReply,
  } = useCommunityStore();

  const [animeNews, setAnimeNews] = useState<AnimeNewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<AnimeNewsArticle | null>(null);
  const [isNewsArticleLoading, setIsNewsArticleLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<'home' | 'news'>('home');
  const [topicSort, setTopicSort] = useState<'popular' | 'latest'>('latest');
  const [newsLayout, setNewsLayout] = useState<'column' | 'list'>('column');
  const [newsViewMenuVisible, setNewsViewMenuVisible] = useState(false);

  // Thread Discussion Modal State
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumComment[]>([]);
  const [isRepliesLoading, setIsRepliesLoading] = useState(false);
  const [newReplyText, setNewReplyText] = useState('');

  // Create Topic & Auth Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicBody, setTopicBody] = useState('');
  const [topicImages, setTopicImages] = useState<string[]>([]);

  // Reply composer attachments + @mention target
  const [replyImages, setReplyImages] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const replyInputRef = useRef<TextInput>(null);

  // Current user's real profile photo (Google/Supabase avatar) + display name,
  // used to backfill avatars on threads/replies created before avatars were stored.
  const myAvatarUrl = getUserAvatarUrl(user);
  const myDisplayName = user ? getUserDisplayName(user) : '';

  // Profile photos resolved from the public community tables — readable whether
  // the viewer is signed in or not. Cached per username for the session.
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

  // Custom Confirmation Dialog State
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
    onConfirm: () => {},
  });

  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    setIsLoading(true);
    const news = await getAnimeNews();
    setAnimeNews(news);
    hydrateNewsImages(news);
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const news = await getAnimeNews(true);
    setAnimeNews(news);
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
    // Persist so covers survive remounts / tab switches within the cache window
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
      // Write the loaded cover back into the feed list + cache so going back
      // shows the thumbnail instead of the placeholder.
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

  const combinedThreads = useMemo(() => {
    return userThreads;
  }, [userThreads]);

  const filteredThreads = useMemo(() => {
    const matchingThreads = combinedThreads.filter((t) => {
      const matchSearch =
        !searchQuery.trim() ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.author.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });

    return [...matchingThreads].sort((a, b) => {
      if (topicSort === 'popular') return b.repliesCount - a.repliesCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [combinedThreads, searchQuery, topicSort]);

  useEffect(() => {
    ensureDbAvatars(combinedThreads.map((t) => t.author));
  }, [combinedThreads, ensureDbAvatars]);

  const handleOpenThread = async (thread: ForumThread) => {
    setSelectedThread(thread);
    setIsRepliesLoading(true);

    const storedReplies = threadReplies[thread.id];
    let fetchedReplies: ForumComment[] = [];
    if (storedReplies && storedReplies.length > 0) {
      fetchedReplies = storedReplies;
    } else {
      fetchedReplies = await getThreadReplies(thread.id);
    }
    setReplies(fetchedReplies);
    ensureDbAvatars([thread.author, ...fetchedReplies.map((r) => r.username)]);
    setSelectedThread((prev) => (prev ? { ...prev, repliesCount: fetchedReplies.length } : null));
    setIsRepliesLoading(false);
  };

  const handleOpenCreateTopic = () => {
    if (!user) {
      setConfirmModalConfig({
        visible: true,
        title: 'Sign In Required',
        message: 'Please sign in or create an account to start discussion topics.',
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
        message: 'Please sign in or create an account to participate in community discussions.',
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
  };

  const handleMentionUser = (username: string) => {
    // No self-mentions — mentioning yourself is a no-op
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
      title: 'Delete Topic',
      message: 'Are you sure you want to delete this discussion topic? This action cannot be undone.',
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
      },
    });
  };

  const handleCreateTopic = async () => {
    if (!topicTitle.trim() || (!topicBody.trim() && topicImages.length === 0)) {
      setConfirmModalConfig({
        visible: true,
        title: 'Missing Details',
        message: 'Please enter a title and a description or photo for your topic.',
        iconName: 'document-text-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }
    const authorName = getUserDisplayName(user);
    const created = await createThread({
      title: topicTitle.trim(),
      category: 'Discussion',
      body: topicBody.trim(),
      author: authorName,
      imageUrls: topicImages,
      authorAvatarUrl: isAnonymousIdentity(authorName) ? undefined : myAvatarUrl ?? undefined,
    });

    setShowCreateModal(false);
    setTopicTitle('');
    setTopicBody('');
    setTopicImages([]);
    handleOpenThread(created);
  };

  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[{ flex: 1, width: '100%' }, isWeb && styles.webCenteredContent]}>
        {/* Top Header / Navigation Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeftRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Community</Text>
        </View>

          {feedMode === 'home' && (
            <AnimatedPressable
              onPress={handleOpenCreateTopic}
              style={[
                styles.createBtn,
                { backgroundColor: colors.accent },
              ]}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.createBtnText}>Create post</Text>
            </AnimatedPressable>
          )}
        </View>

        {/* Search stays above the feed switcher so it never competes with Topics, Popular, Latest, or News. */}
        {feedMode !== 'news' && <View style={styles.toolbarWrapper}>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search discussions, topics or users..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <View style={styles.sortRow}>
            <Text style={[styles.sortLabel, { color: colors.textMuted }]}>Sort by</Text>
            {(['latest', 'popular'] as const).map((sort) => (
              <Pressable
                key={sort}
                onPress={() => setTopicSort(sort)}
                style={[
                  styles.sortOption,
                  topicSort === sort && { backgroundColor: colors.accentSubtle },
                ]}
              >
                <Text style={[styles.sortOptionText, { color: topicSort === sort ? colors.text : colors.textMuted }]}>
                  {sort === 'latest' ? 'Latest' : 'Popular'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>}

        <View style={[styles.feedTabs, { backgroundColor: colors.surfaceElevated }]}>
          {(['home', 'news'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setFeedMode(mode)}
              style={[
                styles.feedTab,
                feedMode === mode && { backgroundColor: colors.accentSubtle },
              ]}
            >
              <Text style={[styles.feedTabText, { color: feedMode === mode ? colors.text : colors.textMuted }]}>
                {mode === 'home' ? 'Topics' : 'News'}
              </Text>
            </Pressable>
          ))}
        </View>

        {feedMode === 'news' && (
          <View style={styles.newsViewToolbar}>
            <View style={styles.newsViewDropdownWrap}>
              <Pressable
                onPress={() => setNewsViewMenuVisible((visible) => !visible)}
                style={[styles.newsViewDropdown, { backgroundColor: colors.surfaceElevated }]}
                accessibilityLabel="Change news view"
              >
                <Ionicons
                  name={newsLayout === 'column' ? 'grid-outline' : 'list-outline'}
                  size={16}
                  color={colors.textSecondary}
                />
                <Text style={[styles.sortOptionText, { color: colors.text }]}>
                  {newsLayout === 'column' ? 'Column' : 'List'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </Pressable>
              {newsViewMenuVisible && (
                <View style={[styles.newsViewMenu, { backgroundColor: colors.surfaceElevated }]}>
                  {(['column', 'list'] as const).map((layout) => (
                    <Pressable
                      key={layout}
                      onPress={() => {
                        setNewsLayout(layout);
                        setNewsViewMenuVisible(false);
                      }}
                      style={[styles.newsViewMenuItem, newsLayout === layout && { backgroundColor: colors.accentSubtle }]}
                    >
                      <Ionicons name={layout === 'column' ? 'grid-outline' : 'list-outline'} size={15} color={colors.textSecondary} />
                      <Text style={[styles.sortOptionText, { color: colors.text }]}>
                        {layout === 'column' ? 'Column' : 'List'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Threads Grid / List */}
        {isLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Fetching forum discussions...
            </Text>
          </View>
        ) : feedMode === 'news' ? (
          <FlatList
            data={animeNews}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
            renderItem={({ item, index }) => (
              <AnimatedCard
                index={index}
                onPress={() => handleOpenNews(item)}
                style={[
                  styles.newsCard,
                  newsLayout === 'list' && styles.newsCardList,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View style={newsLayout === 'list' ? styles.newsListRow : styles.newsColumnContent}>
                  {item.imageUrl || item.images?.[0] ? (
                    <Image
                      source={{ uri: (item.imageUrl || (item.images as string[])[0]) as string }}
                      style={[styles.newsImage, newsLayout === 'list' && styles.newsImageList]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.newsImagePlaceholder, newsLayout === 'list' && styles.newsImageList, { backgroundColor: colors.accentSubtle }]}>
                      <Ionicons name="newspaper-outline" size={28} color={colors.accent} />
                    </View>
                  )}
                  <View style={newsLayout === 'list' ? styles.newsTextColumn : undefined}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: colors.accentSubtle }]}>
                      <Text style={[styles.categoryBadgeText, { color: colors.accent }]}>Anime News</Text>
                    </View>
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>
                      {formatChapterDate(item.publishedAt)}
                    </Text>
                  </View>
                  <Text style={[styles.threadTitle, { color: colors.text }]} numberOfLines={3}>
                    {item.title}
                  </Text>
                  <Text style={[styles.threadPreview, { color: colors.textSecondary }]} numberOfLines={3}>
                    {item.summary}
                  </Text>
                  <View style={styles.newsSourceRow}>
                    <Ionicons name="open-outline" size={14} color={colors.accent} />
                    <Text style={[styles.authorText, { color: colors.accent }]}>{item.source}</Text>
                  </View>
                  </View>
                </View>
              </AnimatedCard>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="newspaper-outline" size={54} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No anime news available</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Pull to refresh and try again.</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={filteredThreads}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
            renderItem={({ item, index }) => (
                <AnimatedCard
                  index={index}
                  onPress={() => handleOpenThread(item)}
                  style={[styles.threadCard, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.timeBadgeRow}>
                      <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                      <Text style={[styles.timeText, { color: colors.textMuted }]}>
                        {formatChapterDate(item.createdAt)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.threadTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>

                  <Text style={[styles.threadPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                    Share your theories, reactions, and recommendations with the community.
                  </Text>

                  <View style={styles.cardFooter}>
                    <View style={styles.authorRow}>
                      <UserAvatar
                        uri={resolvePostAvatar(item.authorAvatarUrl, item.author, myDisplayName, myAvatarUrl, dbAvatars[item.author])}
                        name={item.author}
                        size={20}
                        bgColor={colors.accentSubtle}
                        textColor={colors.accent}
                      />
                      <Text style={[styles.authorText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.author}
                      </Text>
                    </View>

                    <View style={styles.repliesRow}>
                      <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.accent} />
                      <Text style={[styles.repliesText, { color: colors.accent }]}>
                        {item.repliesCount} {item.repliesCount === 1 ? 'reply' : 'replies'}
                      </Text>
                    </View>
                    <Ionicons name="bookmark-outline" size={16} color={colors.textMuted} />
                  </View>
                </AnimatedCard>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={54} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No discussions found
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  {searchQuery.trim()
                    ? `No topics match "${searchQuery}". Try a different keyword.`
                    : 'Be the first to start a conversation in this category!'}
                </Text>
              </View>
            }
          />
        )}

        <Modal
          visible={!!selectedNews}
          transparent={isWeb}
          animationType={isWeb ? 'fade' : 'slide'}
          presentationStyle="overFullScreen"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setSelectedNews(null)}
        >
          <View style={[styles.modalOverlay, !isWeb && styles.newsModalOverlayMobile]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedNews(null)} />
            <View style={[styles.newsModalCard, isWeb ? styles.newsModalCardWeb : styles.newsModalCardMobile, { backgroundColor: colors.surface }]}>
              {!isWeb && (
                <SafeAreaView style={[styles.newsModalTopBar, { backgroundColor: colors.surface }]}>
                  <Pressable onPress={() => setSelectedNews(null)} hitSlop={10} style={styles.newsBackButton}>
                    <Ionicons name="arrow-back" size={30} color={colors.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => selectedNews && WebBrowser.openBrowserAsync(selectedNews.url)}
                    hitSlop={10}
                    style={styles.newsArticleActionButton}
                    accessible={false}
                    importantForAccessibility="no"
                  >
                    <Ionicons name="open-outline" size={25} color={colors.text} />
                  </Pressable>
                </SafeAreaView>
              )}
              <ScrollView contentContainerStyle={styles.newsModalContent} showsVerticalScrollIndicator={false}>
                <View style={styles.newsModalHero}>
                  {selectedNews?.imageUrl ? (
                    <Image source={{ uri: selectedNews.imageUrl }} style={styles.newsModalImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.newsModalImage, styles.newsModalImageFallback, { backgroundColor: colors.accentSubtle }]}>
                      <Ionicons name="newspaper-outline" size={36} color={colors.accent} />
                    </View>
                  )}
                </View>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.categoryBadgeText, { color: colors.accent }]}>Anime News Network</Text>
                  <Text style={[styles.timeText, { color: colors.textMuted }]}>
                    {selectedNews ? formatChapterDate(selectedNews.publishedAt) : ''}
                  </Text>
                </View>
                <Text style={[styles.newsModalTitle, { color: colors.text }]}>{selectedNews?.title}</Text>
                <Text style={[styles.newsModalSummary, { color: colors.textSecondary }]}>
                  {selectedNews?.summary}
                </Text>
                {isNewsArticleLoading ? (
                  <View style={styles.newsArticleLoading}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={[styles.newsModalSummary, { color: colors.textMuted }]}>Loading full article…</Text>
                  </View>
                ) : (
                  selectedNews?.content.map((paragraph, index) => (
                    <Text key={`${selectedNews.url}-${index}`} style={[styles.newsArticleText, { color: colors.text }]}>
                      {paragraph}
                    </Text>
                  ))
                )}
                {(selectedNews?.trailerUrls?.length || selectedNews?.trailerUrl) && (
                  <View style={styles.newsTrailerBlock}>
                    <Text style={[styles.newsSectionLabel, { color: colors.text }]}>Trailer</Text>
                    {(selectedNews.trailerUrls || [selectedNews.trailerUrl])
                      .filter((url): url is string => Boolean(url))
                      .map((trailerUrl, index) => {
                        const embedUrl = getYomiteTrailerEmbedUrl(trailerUrl);
                        return isWeb ? (
                          React.createElement('iframe', {
                            key: embedUrl,
                            src: embedUrl,
                            title: `${selectedNews?.title} trailer ${index + 1}`,
                            style: { width: '100%', height: 210, border: 0, borderRadius: 10, marginBottom: 8 },
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
          </View>
        </Modal>

        {feedMode === 'home' && (
          <AnimatedPressable
            onPress={handleOpenCreateTopic}
            style={[styles.fab, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Create new discussion topic"
          >
            <Ionicons name="add" size={20} color="#0A0B0E" />
            <Text style={styles.fabText}>Create post</Text>
          </AnimatedPressable>
        )}

        {/* Interactive Thread Discussion Modal */}
        <Modal
          visible={!!selectedThread}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedThread(null)}
          statusBarTranslucent
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.backdrop} onPress={() => setSelectedThread(null)} />
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={[
                        styles.modeBadge,
                        {
                          backgroundColor: colors.accentSubtle,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modeBadgeText,
                          { color: colors.accent },
                        ]}
                      >
                        Live Discussion
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.modalThreadTitle, { color: colors.text }]} numberOfLines={2}>
                    {selectedThread?.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                      Started by <Text style={{ color: colors.text, fontWeight: '600' }}>{selectedThread?.author}</Text>
                    </Text>
                    <Text style={{ color: colors.textMuted }}>•</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                      <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                        {selectedThread ? formatChapterDate(selectedThread.createdAt) : ''}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {user && (selectedThread?.author === getUserDisplayName(user) || selectedThread?.id?.startsWith('custom_')) && (
                    <Pressable
                      onPress={() => selectedThread && handleDeleteTopic(selectedThread.id)}
                      hitSlop={8}
                      style={styles.closeBtn}
                      accessibilityLabel="Delete topic"
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => setSelectedThread(null)}
                    hitSlop={8}
                    style={styles.closeBtn}
                    accessibilityLabel="Close discussion"
                  >
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              {/* Replies List */}
              {isRepliesLoading ? (
                <View style={styles.centerLoading}>
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Loading discussion replies...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={replies}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.repliesListContainer}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={[styles.replyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                      <View style={styles.replyHeaderRow}>
                        <View style={styles.replyUserCol}>
                          <UserAvatar
                            uri={resolvePostAvatar(item.avatarUrl, item.username, myDisplayName, myAvatarUrl, dbAvatars[item.username])}
                            name={item.username}
                            size={28}
                            bgColor={colors.accentSubtle}
                            textColor={colors.accent}
                          />
                          <View style={{ gap: 1 }}>
                            <Text style={[styles.replyUsername, { color: colors.text }]}>{item.username}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                              <Text style={[styles.replyTime, { color: colors.textMuted }]}>
                                {formatChapterDate(item.postedAt)}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          {item.username !== myDisplayName ? (
                            <Pressable
                              onPress={() => handleMentionUser(item.username)}
                              hitSlop={6}
                              accessibilityLabel={`Mention ${item.username}`}
                            >
                              <Ionicons name="at" size={15} color={colors.accent} />
                            </Pressable>
                          ) : null}
                          {user && (item.username === getUserDisplayName(user) || item.id.startsWith('reply_')) && (
                            <Pressable
                              onPress={() => handleDeleteReply(item.id)}
                              hitSlop={6}
                              accessibilityLabel="Delete reply"
                            >
                              <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                            </Pressable>
                          )}
                          <View style={styles.likesRow}>
                            <Ionicons name="heart-outline" size={14} color={colors.accent} />
                            <Text style={[styles.likesText, { color: colors.textMuted }]}>{item.likes}</Text>
                          </View>
                        </View>
                      </View>

                      {item.replyTo ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="return-up-forward" size={11} color={colors.accent} />
                          <Text style={[styles.replyToText, { color: colors.accent }]} numberOfLines={1}>
                            {item.replyTo === myDisplayName && myDisplayName
                              ? 'Replying to yourself'
                              : `Replying to @${item.replyTo}`}
                          </Text>
                        </View>
                      ) : null}

                      {item.body ? (
                        <MentionText body={item.body} textColor={colors.text} accentColor={colors.accent} />
                      ) : null}

                      {item.imageUrls && item.imageUrls.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.replyImagesRow}>
                          {item.imageUrls.map((uri) => (
                            <Image key={uri} source={{ uri }} style={styles.replyImageThumb} resizeMode="cover" />
                          ))}
                        </ScrollView>
                      ) : null}
                    </View>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyRepliesContainer}>
                      <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} />
                      <Text style={{ color: colors.textSecondary, fontSize: Typography.sizes.footnote, fontWeight: Typography.weights.bold }}>
                        No replies on this thread yet
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: Typography.sizes.caption, textAlign: 'center', paddingHorizontal: 30 }}>
                        Be the first to reply below!
                      </Text>
                    </View>
                  }
                />
              )}

              {/* Post Reply Composer — single container growing upward, no seams */}
              <View style={[styles.composerBox, { backgroundColor: colors.surfaceElevated }]}>
                {replyTo ? (
                  <View style={styles.replyingToBar}>
                    <Ionicons name="at" size={13} color={colors.accent} />
                    <Text style={[styles.replyingToText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {replyTo === myDisplayName && myDisplayName ? (
                        <>Replying to <Text style={{ color: colors.accent, fontWeight: '700' }}>yourself</Text></>
                      ) : (
                        <>Replying to <Text style={{ color: colors.accent, fontWeight: '700' }}>@{replyTo}</Text></>
                      )}
                    </Text>
                    <Pressable onPress={() => setReplyTo(null)} hitSlop={8} accessibilityLabel="Clear mention">
                      <Ionicons name="close-circle" size={15} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ) : null}
                {replyImages.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.composerPreviewRow}>
                    {replyImages.map((uri) => (
                      <View key={uri} style={styles.composerPreviewWrap}>
                        <Image source={{ uri }} style={styles.composerPreviewThumb} resizeMode="cover" />
                        <Pressable
                          onPress={() => setReplyImages((prev) => prev.filter((u) => u !== uri))}
                          hitSlop={6}
                          style={styles.composerPreviewRemove}
                          accessibilityLabel="Remove photo"
                        >
                          <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
                <View style={[styles.replyInputRow, { backgroundColor: 'transparent', borderTopWidth: 0 }]}>
                  <Pressable
                    onPress={async () => setReplyImages(await pickCommunityImages(replyImages))}
                    hitSlop={6}
                    accessibilityLabel="Attach photos to reply"
                  >
                    <Ionicons name="image-outline" size={20} color={replyImages.length > 0 ? colors.accent : colors.textMuted} />
                  </Pressable>
                  <TextInput
                    ref={replyInputRef}
                    style={[styles.replyInput, { color: colors.text }]}
                    placeholder="Join the discussion..."
                    placeholderTextColor={colors.textMuted}
                    value={newReplyText}
                    onChangeText={setNewReplyText}
                    multiline
                  />
                  <Pressable
                    onPress={handleSendReply}
                    disabled={!newReplyText.trim() && replyImages.length === 0}
                    style={[styles.sendBtn, { backgroundColor: colors.accent, opacity: newReplyText.trim() || replyImages.length > 0 ? 1 : 0.4 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Send reply"
                  >
                    <Ionicons name="send" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Create New Discussion Topic Modal */}
        <Modal
          visible={showCreateModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCreateModal(false)}
          statusBarTranslucent
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.backdrop} onPress={() => setShowCreateModal(false)} />
            <View style={[styles.createModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalThreadTitle, { color: colors.text }]}>Start a New Topic</Text>
                  <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                    Post a question, theory, or review for the community
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowCreateModal(false)}
                  hitSlop={8}
                  style={styles.closeBtn}
                  accessibilityLabel="Close modal"
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView style={{ flexGrow: 1 }} contentContainerStyle={styles.createFormGroup} showsVerticalScrollIndicator={false}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Topic Title</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g., Solo Leveling Chapter 100 Reaction"
                  placeholderTextColor={colors.textMuted}
                  value={topicTitle}
                  onChangeText={setTopicTitle}
                />

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Discussion Body</Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    styles.textAreaInput,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text },
                  ]}
                  placeholder="Share your thoughts, review, or theories..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={5}
                  value={topicBody}
                  onChangeText={setTopicBody}
                />

                <Pressable
                  onPress={async () => setTopicImages(await pickCommunityImages(topicImages))}
                  style={({ pressed }) => [
                    styles.attachPhotosBtn,
                    { backgroundColor: colors.surfaceElevated, opacity: pressed ? 0.7 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Attach photos to topic"
                >
                  <Ionicons name="image-outline" size={18} color={topicImages.length > 0 ? colors.accent : colors.textSecondary} />
                  <Text style={[styles.attachPhotosText, { color: colors.textSecondary }]}>
                    {topicImages.length > 0 ? `${topicImages.length}/${MAX_UPLOAD_IMAGES} photos attached` : 'Add photos'}
                  </Text>
                </Pressable>

                {topicImages.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.composerPreviewRow}>
                    {topicImages.map((uri) => (
                      <View key={uri} style={styles.composerPreviewWrap}>
                        <Image source={{ uri }} style={styles.composerPreviewThumb} resizeMode="cover" />
                        <Pressable
                          onPress={() => setTopicImages((prev) => prev.filter((u) => u !== uri))}
                          hitSlop={6}
                          style={styles.composerPreviewRemove}
                          accessibilityLabel="Remove photo"
                        >
                          <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}

                <Pressable
                  onPress={handleCreateTopic}
                  style={({ pressed }) => [
                    styles.publishBtn,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Publish topic"
                >
                  <Ionicons name="create" size={18} color="#FFFFFF" />
                  <Text style={styles.publishBtnText}>Publish Topic</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Auth Modal for Unauthenticated Users */}
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />

        {/* Confirmation Modal */}
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

        {/* Hamburger Slide Drawer */}
        <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webCenteredContent: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'flex-start',
  },
  headerLeftRow: {
    alignItems: 'flex-start',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'web' ? Spacing.lg : Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.5,
  },
  feedTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    padding: 3,
    gap: 2,
  },
  feedTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  feedTabText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: Radius.full,
    gap: 6,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  toolbarWrapper: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs + 2,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 0,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.footnote,
    height: '100%',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  sortLabel: {
    fontSize: Typography.sizes.caption,
    marginRight: 2,
  },
  sortOption: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  sortOptionText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: Typography.sizes.footnote,
  },
  listContainer: {
    paddingHorizontal: 0,
    paddingTop: Spacing.xs,
    paddingBottom: 120,
  },
  threadCard: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    gap: Spacing.xs,
  },
  newsCard: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    gap: Spacing.xs,
  },
  newsCardList: {
    minHeight: 128,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 0,
  },
  newsImage: {
    width: '100%',
    height: 150,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  newsImagePlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  newsImageList: {
    width: 128,
    height: 128,
    flexShrink: 0,
    marginRight: Spacing.md,
    marginBottom: 0,
    borderRadius: 0,
  },
  newsTextColumn: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Spacing.md,
  },
  newsListRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    minHeight: 128,
  },
  newsColumnContent: {
    width: '100%',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  modeBadgeText: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
  },
  timeText: {
    fontSize: Typography.sizes.caption,
  },
  threadTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
    lineHeight: 20,
  },
  threadPreview: {
    fontSize: Typography.sizes.caption,
    lineHeight: 17,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  authorText: {
    fontSize: Typography.sizes.caption,
    maxWidth: 200,
  },
  repliesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  repliesText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.bold,
  },
  newsSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  newsViewToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    position: 'relative',
    zIndex: 10,
  },
  newsViewDropdownWrap: {
    position: 'relative',
  },
  newsViewDropdown: {
    minWidth: 116,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    borderWidth: 0,
    borderRadius: Radius.md,
  },
  newsViewMenu: {
    position: 'absolute',
    top: 42,
    right: 0,
    minWidth: 140,
    borderWidth: 0,
    borderRadius: Radius.md,
    padding: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  newsViewMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 9,
    borderRadius: Radius.sm,
  },
  newsModalCard: {
    width: '100%',
    overflow: 'hidden',
  },
  newsModalCardWeb: {
    maxWidth: 720,
    maxHeight: '82vh' as any,
    borderRadius: Radius.lg,
  },
  newsModalCardMobile: {
    flex: 1,
    borderRadius: 0,
  },
  newsModalOverlayMobile: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-start',
    padding: 0,
  },
  newsModalHero: {
    position: 'relative',
    paddingHorizontal: 0,
  },
  newsModalTopBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newsModalImage: {
    width: '100%',
    height: 210,
    borderRadius: Radius.sm,
  },
  newsModalImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsBackButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsArticleActionButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsModalContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  newsModalTitle: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
    lineHeight: 28,
  },
  newsModalSummary: {
    fontSize: Typography.sizes.body,
    lineHeight: 23,
  },
  newsArticleLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  newsArticleText: {
    fontSize: Typography.sizes.body,
    lineHeight: 24,
  },
  newsTrailerBlock: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  newsTrailerWebView: {
    width: '100%',
    height: 210,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  newsSectionLabel: {
    fontSize: Typography.sizes.title3,
    fontWeight: Typography.weights.bold,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 24,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  fabText: {
    color: '#0A0B0E',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.caption,
    textAlign: 'center',
    maxWidth: 320,
  },

  /* Modals */
  timeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 820 : 600,
    height: Platform.OS === 'web' ? ('85vh' as any) : '85%',
    borderRadius: Radius.lg,
    borderWidth: 0,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  createModalCard: {
    width: '100%',
    maxWidth: 540,
    maxHeight: Platform.OS === 'web' ? ('85vh' as any) : '85%',
    borderRadius: Radius.lg,
    borderWidth: 0,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalThreadTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
    lineHeight: 22,
  },
  modalSub: {
    fontSize: Typography.sizes.caption,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  repliesListContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  replyCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0,
    gap: Spacing.xs,
  },
  replyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyUserCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.bold,
  },
  replyUsername: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  replyTime: {
    fontSize: 10,
  },
  likesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesText: {
    fontSize: Typography.sizes.caption,
  },
  replyBody: {
    fontSize: Typography.sizes.footnote,
    lineHeight: 18,
    marginTop: 2,
  },
  replyToText: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
  },
  replyImagesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    paddingRight: Spacing.md,
  },
  replyImageThumb: {
    width: 112,
    height: 84,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  composerBox: {
    gap: 4,
    paddingTop: 6,
    paddingBottom: 6,
  },
  replyingToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
  },
  replyingToText: {
    flex: 1,
    fontSize: Typography.sizes.caption,
  },
  composerPreviewRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingTop: 6,
    paddingBottom: 2,
  },
  composerPreviewWrap: {
    position: 'relative',
  },
  composerPreviewThumb: {
    width: 54,
    height: 54,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  composerPreviewRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
  },
  attachPhotosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderRadius: Radius.md,
  },
  attachPhotosText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  emptyRepliesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 8,
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  replyInput: {
    flex: 1,
    fontSize: Typography.sizes.footnote,
    paddingVertical: Spacing.xs,
    maxHeight: 110,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  readOnlyText: {
    flex: 1,
    fontSize: Typography.sizes.caption,
    lineHeight: 16,
  },
  createFormGroup: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  inputLabel: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.xs,
  },
  modalInput: {
    borderRadius: Radius.md,
    borderWidth: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.sizes.footnote,
  },
  textAreaInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: Radius.md,
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
});
