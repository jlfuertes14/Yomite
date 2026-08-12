import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useDownloadStore, DownloadedChapter } from '../../src/store/downloadStore';
import { removeDownloadedChapter, downloadChapter, getBaseDownloadDirectory, getDisplayDownloadDirectory, pickAndroidStorageDirectory } from '../../src/services/downloadService';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { formatChapterDate } from '../../src/utils/date';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';

export default function DownloadsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { chapters, downloadDirectory, setCustomStorageDirectory } = useDownloadStore();

  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [customPathInput, setCustomPathInput] = useState('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());

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

  const chapterList = Object.values(chapters).sort(
    (a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime()
  );

  const filteredChapters = chapterList.filter((item) => {
    if (activeTab === 'completed') return item.status === 'completed';
    if (activeTab === 'in_progress') return item.status === 'downloading' || item.status === 'pending' || item.status === 'error';
    return true;
  });

  const totalSizeBytes = chapterList.reduce((acc, curr) => acc + (curr.sizeBytes || 0), 0);
  const totalMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  const activeDirectory = getDisplayDownloadDirectory();
  const isSelecting = selectedChapterIds.size > 0;
  const allVisibleSelected = filteredChapters.length > 0 && filteredChapters.every((item) => selectedChapterIds.has(item.chapterId));

  const toggleChapterSelection = (chapterId: string) => {
    setSelectedChapterIds((current) => {
      const next = new Set(current);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedChapterIds((current) => {
      const next = new Set(current);
      if (filteredChapters.every((item) => next.has(item.chapterId))) {
        filteredChapters.forEach((item) => next.delete(item.chapterId));
      } else {
        filteredChapters.forEach((item) => next.add(item.chapterId));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedChapterIds(new Set());

  const handlePickNativeFolder = async () => {
    const selected = await pickAndroidStorageDirectory();
    if (selected) {
      setCustomPathInput(selected);
      setShowFolderModal(false);
      setConfirmModalConfig({
        visible: true,
        title: 'Storage Directory Updated',
        message: `Yomite will save future downloads to:\n${getDisplayDownloadDirectory()}`,
        iconName: 'folder-open-outline',
        confirmText: 'Got It',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
    }
  };

  const handleSaveCustomDirectory = () => {
    if (!customPathInput.trim()) {
      setCustomStorageDirectory('');
    } else {
      setCustomStorageDirectory(customPathInput.trim());
    }
    setShowFolderModal(false);
    setConfirmModalConfig({
      visible: true,
      title: 'Storage Directory Saved',
      message: 'Downloads will now be saved to your specified custom folder.',
      iconName: 'folder-outline',
      confirmText: 'OK',
      cancelText: '',
      confirmVariant: 'primary',
      onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
    });
  };

  const handleReadChapter = (item: DownloadedChapter) => {
    router.push(`/reader/${item.chapterId}?mangaId=${item.mangaId}` as any);
  };

  const handleDeleteItem = (item: DownloadedChapter) => {
    setConfirmModalConfig({
      visible: true,
      title: 'Delete Downloaded Chapter',
      message: `Are you sure you want to remove ${item.mangaTitle} Ch. ${item.chapterNum} from local storage?`,
      iconName: 'trash-outline',
      confirmText: 'Delete Chapter',
      confirmVariant: 'destructive',
      onConfirm: () => {
        removeDownloadedChapter(item.chapterId, item.mangaId);
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  const handleDeleteSelected = () => {
    const selected = chapterList.filter((item) => selectedChapterIds.has(item.chapterId));
    if (selected.length === 0) return;

    setConfirmModalConfig({
      visible: true,
      title: `Delete ${selected.length} ${selected.length === 1 ? 'Chapter' : 'Chapters'}`,
      message: `Remove the selected ${selected.length === 1 ? 'chapter' : 'chapters'} from local storage?`,
      iconName: 'trash-outline',
      confirmText: 'Delete Selected',
      confirmVariant: 'destructive',
      onConfirm: async () => {
        await Promise.all(selected.map((item) => removeDownloadedChapter(item.chapterId, item.mangaId)));
        clearSelection();
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  const handleRetryItem = (item: DownloadedChapter) => {
    downloadChapter({
      chapterId: item.chapterId,
      mangaId: item.mangaId,
      mangaTitle: item.mangaTitle,
      chapterNum: item.chapterNum,
      chapterTitle: item.chapterTitle,
      coverUrl: item.coverUrl,
    });
  };

  const renderDownloadItem = ({ item, index }: { item: DownloadedChapter; index: number }) => {
    const isCompleted = item.status === 'completed';
    const isError = item.status === 'error';
    const isDownloading = item.status === 'downloading';
    const progressPercent = item.totalFiles > 0 ? Math.round((item.downloadedFiles / item.totalFiles) * 100) : 0;

    return (
      <AnimatedCard
        index={index}
        onPress={() => {
          if (isSelecting) toggleChapterSelection(item.chapterId);
          else if (isCompleted) handleReadChapter(item);
        }}
        style={[
          styles.itemCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {isSelecting && (
          <Pressable
            onPress={() => toggleChapterSelection(item.chapterId)}
            hitSlop={8}
            style={styles.selectionCheck}
          >
            <Ionicons
              name={selectedChapterIds.has(item.chapterId) ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={selectedChapterIds.has(item.chapterId) ? colors.accent : colors.textMuted}
            />
          </Pressable>
        )}
        <View style={[styles.coverContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={styles.coverImage} contentFit="cover" transition={200} />
          ) : (
            <Ionicons name="book-outline" size={24} color={colors.textMuted} />
          )}
        </View>

        <View style={styles.itemInfo}>
          <Text style={[styles.mangaTitle, { color: colors.text }]} numberOfLines={1}>
            {item.mangaTitle}
          </Text>
          <Text style={[styles.chapterTitle, { color: colors.textSecondary }]} numberOfLines={1}>
            Ch. {item.chapterNum} {item.chapterTitle ? `· ${item.chapterTitle}` : ''}
          </Text>

          {isDownloading && (
            <View style={styles.progressRow}>
              <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceElevated }]}>
                <View style={[styles.progressBarFill, { backgroundColor: colors.accent, width: `${progressPercent}%` }]} />
              </View>
              <Text style={[styles.progressText, { color: colors.accent }]}>
                {item.downloadedFiles}/{item.totalFiles} ({progressPercent}%)
              </Text>
            </View>
          )}

          {isCompleted && (
            <View style={styles.metaRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.emerald} />
              <Text style={[styles.metaText, { color: colors.emerald }]}>
                Saved Offline · {(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB
              </Text>
            </View>
          )}

          {isError && (
            <View style={styles.metaRow}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" />
              <Text style={[styles.metaText, { color: '#EF4444' }]}>
                Download Error: {item.errorMessage || 'Network failed'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.itemActions}>
          {isError && (
            <Pressable onPress={() => handleRetryItem(item)} style={styles.iconBtn}>
              <Ionicons name="refresh-outline" size={20} color={colors.accent} />
            </Pressable>
          )}

          <Pressable onPress={() => handleDeleteItem(item)} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </AnimatedCard>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isSelecting ? `${selectedChapterIds.size} Selected` : 'Downloads'}
          </Text>
          <Text style={[styles.headerSubTitle, { color: colors.textSecondary }]}>
            {chapterList.filter((c) => c.status === 'completed').length} Chapters ({totalMB} MB total)
          </Text>
        </View>

        <View style={styles.headerActions}>
          {isSelecting ? (
            <>
              <Pressable onPress={toggleSelectAllVisible} style={[styles.folderConfigBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Ionicons name={allVisibleSelected ? 'remove-circle-outline' : 'checkmark-done-outline'} size={18} color={colors.accent} />
                <Text style={[styles.folderConfigText, { color: colors.text }]}>{allVisibleSelected ? 'Clear' : 'All'}</Text>
              </Pressable>
              <Pressable onPress={handleDeleteSelected} style={[styles.folderConfigBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}>
                <Ionicons name="trash-outline" size={18} color={colors.accent} />
                <Text style={[styles.folderConfigText, { color: colors.accent }]}>Delete</Text>
              </Pressable>
              <Pressable onPress={clearSelection} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </>
          ) : (
            <>
              {filteredChapters.length > 0 && (
                <Pressable onPress={toggleSelectAllVisible} style={[styles.folderConfigBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.accent} />
                  <Text style={[styles.folderConfigText, { color: colors.text }]}>Select</Text>
                </Pressable>
              )}
              <AnimatedPressable
                onPress={() => {
                  setCustomPathInput(downloadDirectory || '');
                  setShowFolderModal(true);
                }}
                style={[styles.folderConfigBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <Ionicons name="folder-open-outline" size={18} color={colors.accent} />
                <Text style={[styles.folderConfigText, { color: colors.text }]}>Location</Text>
              </AnimatedPressable>
            </>
          )}
        </View>
      </View>

      {/* Active Storage Banner */}
      <View style={[styles.storageBanner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Ionicons name="hardware-chip-outline" size={16} color={colors.accent} />
        <Text style={[styles.storageBannerText, { color: colors.textSecondary }]} numberOfLines={1}>
          Path: {activeDirectory}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['all', 'completed', 'in_progress'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              { backgroundColor: activeTab === tab ? colors.accent : colors.surfaceElevated },
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === tab ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {tab === 'all' ? 'All' : tab === 'completed' ? 'Completed' : 'Downloading'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Downloads List */}
      <FlatList
        data={filteredChapters}
        keyExtractor={(item) => item.chapterId}
        renderItem={renderDownloadItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-download-outline" size={54} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Downloads Found</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              {activeTab === 'completed'
                ? 'You have no completed chapter downloads.'
                : 'Downloaded chapters will appear here for offline reading.'}
            </Text>
          </View>
        }
      />

      {/* Storage Folder Selection Modal */}
      <Modal visible={showFolderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="folder" size={22} color={colors.accent} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>Storage Folder Path</Text>
            </View>

            <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
              Open Android's native File Manager to select or create a folder, or enter a custom path manually:
            </Text>

            {Platform.OS === 'android' && (
              <AnimatedPressable
                onPress={handlePickNativeFolder}
                style={[styles.pickFolderBtn, { backgroundColor: colors.accent }]}
              >
                <Ionicons name="folder-open" size={18} color="#FFFFFF" />
                <Text style={styles.pickFolderBtnText}>Browse & Select Android Storage Folder</Text>
              </AnimatedPressable>
            )}

            <View style={{ gap: 6, marginVertical: Spacing.sm }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Custom Local Directory Path:</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                placeholder="/storage/emulated/0/Download/Yomite"
                placeholderTextColor={colors.textMuted}
                value={customPathInput}
                onChangeText={setCustomPathInput}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalActionsRow}>
              <Pressable
                onPress={() => setShowFolderModal(false)}
                style={[styles.modalBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>

              <AnimatedPressable
                onPress={handleSaveCustomDirectory}
                style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Save Location</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sleek Custom Deletion & Storage Confirmation Dialog */}
      <ConfirmationModal
        visible={confirmModalConfig.visible}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        iconName={confirmModalConfig.iconName || 'folder-outline'}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  headerSubTitle: {
    fontSize: Typography.sizes.footnote,
    marginTop: 2,
  },
  folderConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 6,
  },
  folderConfigText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  storageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    gap: 6,
  },
  storageBannerText: {
    fontSize: Typography.sizes.caption,
    flex: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tabBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  tabBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  selectionCheck: {
    marginRight: -Spacing.xs,
  },
  coverContainer: {
    width: 44,
    height: 62,
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  mangaTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  chapterTitle: {
    fontSize: Typography.sizes.footnote,
  },
  progressRow: {
    gap: 4,
    marginTop: 4,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  progressText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  metaText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  emptySub: {
    fontSize: Typography.sizes.footnote,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalContent: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  modalSubtext: {
    fontSize: Typography.sizes.footnote,
    lineHeight: 18,
  },
  pickFolderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    gap: 8,
  },
  pickFolderBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  inputLabel: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
  },
  modalInput: {
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.footnote,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  modalBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
});
