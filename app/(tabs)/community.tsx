import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getCommunityForums,
  getThreadReplies,
  ForumThread,
  ForumComment,
} from '../../src/api/community';
import { useCommunityStore } from '../../src/store/communityStore';
import { useUserStore } from '../../src/store/userStore';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { formatChapterDate } from '../../src/utils/date';

import { AnimatedCard } from '../../src/components/AnimatedCard';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { AuthModal } from '../../src/components/AuthModal';

export default function CommunityScreen() {
  const colors = useThemeColors();
  const user = useUserStore((s) => s.user);

  const {
    userThreads,
    threadReplies,
    createThread,
    addReply,
  } = useCommunityStore();

  const [mangadexThreads, setMangadexThreads] = useState<ForumThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Thread Discussion Modal State
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumComment[]>([]);
  const [isRepliesLoading, setIsRepliesLoading] = useState(false);
  const [newReplyText, setNewReplyText] = useState('');

  // Create Topic & Auth Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicCategory, setTopicCategory] = useState('General Discussion');
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
    const data = await getCommunityForums();
    setMangadexThreads(data);
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const data = await getCommunityForums(true);
    setMangadexThreads(data);
    setRefreshing(false);
  };

  const combinedThreads = [...userThreads, ...mangadexThreads];

  const categories = [
    'All',
    'General Discussion',
    'Art & Design',
    'Scanlation',
    'Anime & Adaptations',
    'Recommendations',
  ];

  const filteredThreads = combinedThreads.filter((t) => {
    if (selectedCategory === 'All') return true;
    return t.category.toLowerCase() === selectedCategory.toLowerCase();
  });

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
        message: 'Please sign in or create an account to start discussion topics and prevent spam.',
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
    if (selectedThread.id.startsWith('mangadex_')) {
      setConfirmModalConfig({
        visible: true,
        title: 'Read-Only Feed',
        message: 'MangaDex chapter feeds are read-only in-app. Tap "New Topic" to start an interactive Yomite discussion!',
        iconName: 'information-circle-outline',
        confirmText: 'Got It',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }
    const authorName = user.email ? user.email.split('@')[0] : 'Yomite Reader';
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
    const authorName = user?.email ? user.email.split('@')[0] : 'Yomite Member';
    const created = await createThread({
      title: topicTitle.trim(),
      category: topicCategory,
      body: topicBody.trim(),
      author: authorName,
    });

    setShowCreateModal(false);
    setTopicTitle('');
    setTopicBody('');
    handleOpenThread(created);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Community Forums</Text>
          <Text style={[styles.headerSubTitle, { color: colors.textSecondary }]}>
            Join live discussions on chapters, artwork & news
          </Text>
        </View>

        <AnimatedPressable
          onPress={handleOpenCreateTopic}
          style={[
            styles.createBtn,
            { backgroundColor: colors.accent },
          ]}
        >
          <Ionicons name="add-circle" size={18} color="#FFFFFF" />
          <Text style={styles.createBtnText}>New Topic</Text>
        </AnimatedPressable>
      </View>

      {/* Categories Horizontal Filter Bar */}
      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoriesContainer}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setSelectedCategory(item)}
              style={[
                styles.categoryChip,
                { backgroundColor: selectedCategory === item ? colors.accent : colors.surfaceElevated },
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: selectedCategory === item ? '#FFF' : colors.textSecondary },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Threads List */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Fetching forum discussions...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredThreads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          renderItem={({ item, index }) => {
            const isMangaDex = item.id.startsWith('mangadex_');
            return (
              <AnimatedCard
                index={index}
                onPress={() => handleOpenThread(item)}
                style={[
                  styles.threadCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.categoryBadge, { backgroundColor: colors.surfaceElevated }]}>
                      <Text style={[styles.categoryBadgeText, { color: colors.accent }]}>
                        {item.category}
                      </Text>
                    </View>
                    <View style={[styles.modeBadge, { backgroundColor: isMangaDex ? 'rgba(161, 161, 170, 0.15)' : colors.accentSubtle }]}>
                      <Text style={[styles.modeBadgeText, { color: isMangaDex ? colors.textMuted : colors.accent }]}>
                        {isMangaDex ? 'Read-Only Feed' : 'Interactive'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.timeText, { color: colors.textMuted }]}>
                    {formatChapterDate(item.createdAt)}
                  </Text>
                </View>

                <Text style={[styles.threadTitle, { color: colors.text }]}>{item.title}</Text>

                <View style={styles.cardFooter}>
                  <View style={styles.authorRow}>
                    <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.authorText, { color: colors.textSecondary }]}>
                      {item.author}
                    </Text>
                  </View>

                  <View style={styles.repliesRow}>
                    <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.accent} />
                    <Text style={[styles.repliesText, { color: colors.accent }]}>
                      {item.repliesCount} replies
                    </Text>
                  </View>
                </View>
              </AnimatedCard>
            );
          }}
        />
      )}

      {/* Interactive Thread Discussion Modal */}
      <Modal
        visible={!!selectedThread}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedThread(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.categoryBadgeText, { color: colors.accent }]}>
                      {selectedThread?.category}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.modeBadge,
                      {
                        backgroundColor: selectedThread?.id.startsWith('mangadex_')
                          ? 'rgba(161, 161, 170, 0.15)'
                          : colors.accentSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeBadgeText,
                        { color: selectedThread?.id.startsWith('mangadex_') ? colors.textMuted : colors.accent },
                      ]}
                    >
                      {selectedThread?.id.startsWith('mangadex_') ? 'Read-Only Feed' : 'Interactive'}
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

              <Pressable onPress={() => setSelectedThread(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
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

                    <Text style={[styles.replyBody, { color: colors.textSecondary }]}>{item.body}</Text>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 8 }}>
                    <Ionicons name="chatbubbles-outline" size={36} color={colors.textMuted} />
                    <Text style={{ color: colors.textSecondary, fontSize: Typography.sizes.footnote, fontWeight: Typography.weights.bold }}>
                      No replies on this thread yet
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: Typography.sizes.caption, textAlign: 'center', paddingHorizontal: 30 }}>
                      {selectedThread?.id.startsWith('mangadex_')
                        ? 'MangaDex chapter release feed. Tap "New Topic" to start a live Yomite discussion!'
                        : 'Be the first to reply below!'}
                    </Text>
                  </View>
                }
              />
            )}

            {/* Post Reply Input Footer */}
            {selectedThread?.id.startsWith('mangadex_') ? (
              <View style={[styles.readOnlyBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.readOnlyText, { color: colors.textMuted }]}>
                  MangaDex feeds are read-only in-app. Tap "New Topic" to start an interactive Yomite discussion!
                </Text>
              </View>
            ) : (
              <View style={[styles.replyInputRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
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
                  <Ionicons name="send" size={16} color="#FFF" />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Create New Discussion Topic Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.createModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalThreadTitle, { color: colors.text }]}>Start a New Topic</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                  Post a question, theory, or review for the community
                </Text>
              </View>
              <Pressable onPress={() => setShowCreateModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.createFormGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Topic Title</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g., Solo Leveling Chapter 100 Reaction"
                placeholderTextColor={colors.textMuted}
                value={topicTitle}
                onChangeText={setTopicTitle}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Category</Text>
              <View style={styles.categorySelectRow}>
                {categories.filter((c) => c !== 'All').map((cat) => (
                  <Pressable
                    key={cat}
                    onPress={() => setTopicCategory(cat)}
                    style={[
                      styles.categorySelectChip,
                      {
                        backgroundColor: topicCategory === cat ? colors.accent : colors.surfaceElevated,
                        borderColor: topicCategory === cat ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, color: topicCategory === cat ? '#FFF' : colors.textSecondary, fontWeight: 'bold' }}>
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Discussion Body</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  styles.textAreaInput,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Share your thoughts..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
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
            </View>
          </View>
        </View>
      </Modal>
      {/* Auth Modal for Unauthenticated Users */}
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />

      {/* Sleek Custom Confirmation Dialog */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    gap: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  headerSubTitle: {
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    gap: 6,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  categoriesWrapper: {
    marginVertical: Spacing.sm,
  },
  categoriesContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  categoryChipText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: Typography.sizes.footnote,
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: 110,
    gap: Spacing.md,
  },
  threadCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  modeBadge: {
    paddingHorizontal: Spacing.xs + 2,
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
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorText: {
    fontSize: Typography.sizes.caption,
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
  /* Thread Discussion Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    paddingTop: Spacing.md,
  },
  createModalContent: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
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
    width: 34,
    height: 34,
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
  /* Create Topic Form */
  createFormGroup: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
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
    height: 80,
    textAlignVertical: 'top',
  },
  categorySelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  categorySelectChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
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
