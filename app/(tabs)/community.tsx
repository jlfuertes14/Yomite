/**
 * Community Forums Screen — Modern Web & Mobile Responsive Community Board
 * Features rich category tabs, live thread discussions, responsive web grid layout,
 * centered web dialog modals, and hidden scrollbars.
 */
import React, { useState, useEffect, useMemo } from 'react';
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
import {
  getAnimeNews,
  getAnimeNewsArticle,
  getThreadReplies,
  ForumThread,
  ForumComment,
  AnimeNewsItem,
  AnimeNewsArticle,
} from '../../src/api/community';
import { useCommunityStore } from '../../src/store/communityStore';
import { useUserStore, getUserDisplayName } from '../../src/store/userStore';
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

export default function CommunityScreen() {
  useDocumentTitle('Community');
  const colors = useThemeColors();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const user = useUserStore((s) => s.user);

  const {
    userThreads,
    threadReplies,
    createThread,
    addReply,
  } = useCommunityStore();

  const [animeNews, setAnimeNews] = useState<AnimeNewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<AnimeNewsArticle | null>(null);
  const [isNewsArticleLoading, setIsNewsArticleLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedMode, setFeedMode] = useState<'home' | 'news'>('home');
  const [topicSort, setTopicSort] = useState<'popular' | 'latest'>('latest');

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
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const news = await getAnimeNews(true);
    setAnimeNews(news);
    setRefreshing(false);
  };

  const handleOpenNews = async (item: AnimeNewsItem) => {
    setSelectedNews({ ...item, content: [] });
    setIsNewsArticleLoading(true);
    const article = await getAnimeNewsArticle(item.url);
    if (article) setSelectedNews(article);
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

    if (!newReplyText.trim() || !selectedThread) return;
    const authorName = getUserDisplayName(user);
    const newReply = await addReply({
      threadId: selectedThread.id,
      body: newReplyText.trim(),
      author: authorName,
    });

    setReplies((prev) => [...prev, newReply]);
    setNewReplyText('');
    setSelectedThread({
      ...selectedThread,
      repliesCount: selectedThread.repliesCount + 1,
    });
  };

  const handleCreateTopic = async () => {
    if (!topicTitle.trim() || !topicBody.trim()) {
      setConfirmModalConfig({
        visible: true,
        title: 'Missing Details',
        message: 'Please enter a title and description for your topic.',
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
    });

    setShowCreateModal(false);
    setTopicTitle('');
    setTopicBody('');
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
        </View>

        {/* Search stays above the feed switcher so it never competes with Topics, Popular, Latest, or News. */}
        {feedMode !== 'news' && <View style={styles.toolbarWrapper}>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
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
                style={[styles.newsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.newsImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.newsImagePlaceholder, { backgroundColor: colors.accentSubtle }]}>
                    <Ionicons name="newspaper-outline" size={28} color={colors.accent} />
                  </View>
                )}
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
                  style={[styles.threadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <View style={[styles.modeBadge, { backgroundColor: colors.surfaceElevated }]}>
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
                    <Text style={[styles.timeText, { color: colors.textMuted }]}>
                      {formatChapterDate(item.createdAt)}
                    </Text>
                  </View>

                  <Text style={[styles.threadTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>

                  <Text style={[styles.threadPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                    Share your theories, reactions, and recommendations with the community.
                  </Text>

                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <View style={styles.authorRow}>
                      <View style={[styles.authorAvatar, { backgroundColor: colors.accentSubtle }]}>
                        <Text style={[styles.authorAvatarText, { color: colors.accent }]}>
                          {item.author.charAt(0).toUpperCase()}
                        </Text>
                      </View>
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
          transparent
          animationType={isWeb ? 'fade' : 'slide'}
          onRequestClose={() => setSelectedNews(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedNews(null)} />
            <View style={[styles.newsModalCard, { backgroundColor: colors.surface }]}>
              {selectedNews?.imageUrl ? (
                <Image source={{ uri: selectedNews.imageUrl }} style={styles.newsModalImage} resizeMode="cover" />
              ) : null}
              <ScrollView contentContainerStyle={styles.newsModalContent} showsVerticalScrollIndicator={false}>
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
                {selectedNews?.trailerUrl && (
                  <View style={styles.newsTrailerBlock}>
                    <Text style={[styles.newsSectionLabel, { color: colors.text }]}>Trailer</Text>
                    {isWeb ? (
                      React.createElement('iframe', {
                        src: selectedNews.trailerUrl,
                        title: `${selectedNews.title} trailer`,
                        style: { width: '100%', height: 210, border: 0, borderRadius: 10 },
                        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                        allowFullScreen: true,
                      })
                    ) : (
                      <Pressable
                        onPress={() => WebBrowser.openBrowserAsync(selectedNews.trailerUrl as string)}
                        style={[styles.newsReadButton, { backgroundColor: colors.surfaceElevated }]}
                      >
                        <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                        <Text style={[styles.newsReadButtonText, { color: colors.text }]}>Watch trailer</Text>
                      </Pressable>
                    )}
                  </View>
                )}
                <Pressable
                  onPress={() => selectedNews && WebBrowser.openBrowserAsync(selectedNews.url)}
                  style={[styles.newsReadButton, { backgroundColor: colors.accent }]}
                >
                  <Text style={styles.newsReadButtonText}>Read full article</Text>
                  <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <AnimatedPressable
          onPress={handleOpenCreateTopic}
          style={[styles.fab, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Create new discussion topic"
        >
          <Ionicons name="add" size={20} color="#0A0B0E" />
          <Text style={styles.fabText}>Create post</Text>
        </AnimatedPressable>

        {/* Interactive Thread Discussion Modal */}
        <Modal
          visible={!!selectedThread}
          transparent={true}
          animationType={isWeb ? 'fade' : 'slide'}
          onRequestClose={() => setSelectedThread(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedThread(null)} />
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: 'transparent' }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: 'transparent' }]}>
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
                  <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                    Started by {selectedThread?.author} · {selectedThread ? formatChapterDate(selectedThread.createdAt) : ''}
                  </Text>
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
                          <View style={[styles.avatarCircle, { backgroundColor: colors.accent }]}>
                            <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View>
                            <Text style={[styles.replyUsername, { color: colors.text }]}>{item.username}</Text>
                            <Text style={[styles.replyTime, { color: colors.textMuted }]}>{formatChapterDate(item.postedAt)}</Text>
                          </View>
                        </View>

                        <View style={styles.likesRow}>
                          <Ionicons name="heart-outline" size={14} color={colors.accent} />
                          <Text style={[styles.likesText, { color: colors.textMuted }]}>{item.likes}</Text>
                        </View>
                      </View>

                      <Text style={[styles.replyBody, { color: colors.text }]}>{item.body}</Text>
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

              {/* Post Reply Input Footer */}
              <View style={[styles.replyInputRow, { backgroundColor: colors.surfaceElevated, borderTopColor: colors.border }]}>
                  <TextInput
                    style={[styles.replyInput, { color: colors.text }]}
                    placeholder="Join the discussion..."
                    placeholderTextColor={colors.textMuted}
                    value={newReplyText}
                    onChangeText={setNewReplyText}
                  />
                  <Pressable
                    onPress={handleSendReply}
                    disabled={!newReplyText.trim()}
                    style={[styles.sendBtn, { backgroundColor: colors.accent, opacity: newReplyText.trim() ? 1 : 0.4 }]}
                  >
                    <Ionicons name="send" size={16} color="#FFFFFF" />
                  </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Create New Discussion Topic Modal */}
        <Modal
          visible={showCreateModal}
          transparent={true}
          animationType={isWeb ? 'fade' : 'slide'}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCreateModal(false)} />
            <View style={[styles.createModalCard, { backgroundColor: colors.surface, borderColor: 'transparent' }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalThreadTitle, { color: colors.text }]}>Start a New Topic</Text>
                  <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                    Post a question, theory, or review for the community
                  </Text>
                </View>
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
                  onPress={handleCreateTopic}
                  style={({ pressed }) => [
                    styles.publishBtn,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
                  ]}
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
    borderWidth: 1,
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
    borderWidth: 1,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  newsCard: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  newsImage: {
    width: '100%',
    height: 150,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  newsImagePlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
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
  newsModalCard: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 720 : undefined,
    maxHeight: Platform.OS === 'web' ? '82vh' as any : '86%',
    borderRadius: Platform.OS === 'web' ? Radius.lg : 0,
    overflow: 'hidden',
  },
  newsModalImage: {
    width: '100%',
    height: 210,
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
  newsSectionLabel: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  newsReadButton: {
    minHeight: 44,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  newsReadButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : undefined,
    padding: Platform.OS === 'web' ? Spacing.md : 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 820 : undefined,
    height: Platform.OS === 'web' ? ('85vh' as any) : '82%',
    borderRadius: Platform.OS === 'web' ? Radius.lg : 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
    elevation: 10,
  },
  createModalCard: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 640 : undefined,
    maxHeight: Platform.OS === 'web' ? ('85vh' as any) : '88%',
    borderRadius: Platform.OS === 'web' ? Radius.lg : 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
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
    borderWidth: 1,
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
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  replyInput: {
    flex: 1,
    fontSize: Typography.sizes.footnote,
    paddingVertical: Spacing.xs,
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
    borderTopWidth: 1,
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
    borderWidth: 1,
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
