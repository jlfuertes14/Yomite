import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getChapterComments, ForumComment } from '../api/community';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';
import { formatChapterDate } from '../utils/date';

interface ChapterCommentsModalProps {
  visible: boolean;
  onClose: () => void;
  chapterId: string;
  chapterTitle: string;
}

export function ChapterCommentsModal({
  visible,
  onClose,
  chapterId,
  chapterTitle,
}: ChapterCommentsModalProps) {
  const colors = useThemeColors();
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');

  useEffect(() => {
    if (visible && chapterId) {
      loadComments();
    }
  }, [visible, chapterId]);

  const loadComments = async () => {
    setIsLoading(true);
    const data = await getChapterComments(chapterId);
    setComments(data);
    setIsLoading(false);
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const commentItem: ForumComment = {
      id: Date.now().toString(),
      username: 'You',
      postedAt: new Date().toISOString(),
      body: newCommentText.trim(),
      likes: 1,
    };
    setComments([commentItem, ...comments]);
    setNewCommentText('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: '#141417', borderColor: '#27272A' }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleCol}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Chapter Comments</Text>
              <Text style={[styles.headerSubTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {chapterTitle} · {comments.length} comments
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#A1A1AA" />
            </Pressable>
          </View>

          {/* Comments List */}
          {isLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading discussions...</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => (
                <View style={[styles.commentCard, { backgroundColor: '#18181B', borderColor: '#27272A' }]}>
                  <View style={styles.commentHeader}>
                    <View style={styles.userRow}>
                      <View style={[styles.avatarCircle, { backgroundColor: colors.surfaceElevated }]}>
                        <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
                        <Text style={[styles.postTime, { color: colors.textMuted }]}>
                          {formatChapterDate(item.postedAt)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.likesRow}>
                      <Ionicons name="heart-outline" size={14} color={colors.accent} />
                      <Text style={styles.likesText}>{item.likes}</Text>
                    </View>
                  </View>

                  <Text style={[styles.commentBody, { color: colors.textSecondary }]}>{item.body}</Text>
                </View>
              )}
            />
          )}

          {/* New Comment Input */}
          <View style={[styles.inputRow, { backgroundColor: '#18181B', borderColor: '#27272A' }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Join the discussion..."
              placeholderTextColor="#71717A"
              value={newCommentText}
              onChangeText={setNewCommentText}
            />
            <Pressable
              onPress={handleAddComment}
              style={[styles.sendBtn, { backgroundColor: colors.accent, opacity: newCommentText.trim() ? 1 : 0.5 }]}
            >
              <Ionicons name="send" size={16} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '75%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  headerSubTitle: {
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.xs,
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
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  commentCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userRow: {
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
    color: '#FAFAFA',
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.bold,
  },
  username: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  postTime: {
    fontSize: 10,
  },
  likesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likesText: {
    color: '#A1A1AA',
    fontSize: Typography.sizes.caption,
  },
  commentBody: {
    fontSize: Typography.sizes.footnote,
    lineHeight: 18,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  input: {
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
});
