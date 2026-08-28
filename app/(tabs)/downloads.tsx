import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useDownloadStore, DownloadedChapter } from '../../src/store/downloadStore';
import {
  removeDownloadedChapter,
  downloadChapter,
  pauseDownloadChapter,
  getDisplayDownloadDirectory,
  pickStorageDirectory,
  pickAndroidStorageDirectory,
} from '../../src/services/downloadService';
import { Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';

interface MangaDownloadGroup {
  mangaId: string;
  mangaTitle: string;
  coverUrl: string | null;
  chapters: DownloadedChapter[];
  completedCount: number;
  downloadingCount: number;
  totalSizeBytes: number;
}

export default function DownloadsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { chapters, downloadDirectory, setCustomStorageDirectory } = useDownloadStore();

  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [customPathInput, setCustomPathInput] = useState('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());

  // Track expanded manga accordion cards
  const [expandedMangaIds, setExpandedMangaIds] = useState<Set<string>>(new Set());

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
    if (activeTab === 'in_progress')
      return item.status === 'downloading' || item.status === 'pending' || item.status === 'paused' || item.status === 'error';
    return true;
  });

  // Group chapters by Manga
  const groupedManga: MangaDownloadGroup[] = React.useMemo(() => {
    const map = new Map<string, MangaDownloadGroup>();

    filteredChapters.forEach((ch) => {
      if (!map.has(ch.mangaId)) {
        map.set(ch.mangaId, {
          mangaId: ch.mangaId,
          mangaTitle: ch.mangaTitle,
          coverUrl: ch.coverUrl || null,
          chapters: [],
          completedCount: 0,
          downloadingCount: 0,
          totalSizeBytes: 0,
        });
      }
      const group = map.get(ch.mangaId)!;
      group.chapters.push(ch);
      if (ch.status === 'completed') group.completedCount++;
      if (ch.status === 'downloading' || ch.status === 'pending' || ch.status === 'paused') group.downloadingCount++;
      group.totalSizeBytes += ch.sizeBytes || 0;
    });

    return Array.from(map.values());
  }, [filteredChapters]);

  const totalSizeBytes = chapterList.reduce((acc, curr) => acc + (curr.sizeBytes || 0), 0);
  const totalMB = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  const activeDirectory = getDisplayDownloadDirectory();
  const isSelecting = selectedChapterIds.size > 0;
  const allVisibleSelected =
    filteredChapters.length > 0 &&
    filteredChapters.every((item) => selectedChapterIds.has(item.chapterId));

  const toggleMangaExpand = (mangaId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMangaIds((prev) => {
      const next = new Set(prev);
      if (next.has(mangaId)) next.delete(mangaId);
      else next.add(mangaId);
      return next;
    });
  };

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

  const handlePickFolder = async () => {
    const selected = await pickStorageDirectory();
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

  const handleDeleteMangaGroup = (group: MangaDownloadGroup) => {
    setConfirmModalConfig({
      visible: true,
      title: `Delete ${group.mangaTitle}`,
      message: `Are you sure you want to remove all ${group.chapters.length} downloaded chapters of "${group.mangaTitle}"?`,
      iconName: 'trash-outline',
      confirmText: 'Delete All Chapters',
      confirmVariant: 'destructive',
      onConfirm: async () => {
        await Promise.all(
          group.chapters.map((item) => removeDownloadedChapter(item.chapterId, item.mangaId))
        );
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

  const handlePauseItem = (item: DownloadedChapter) => {
    pauseDownloadChapter(item.chapterId);
  };

  const handleResumeItem = (item: DownloadedChapter) => {
    downloadChapter({
      chapterId: item.chapterId,
      mangaId: item.mangaId,
      mangaTitle: item.mangaTitle,
      chapterNum: item.chapterNum,
      chapterTitle: item.chapterTitle,
      coverUrl: item.coverUrl,
    });
  };

  const renderMangaGroup = ({ item: group, index }: { item: MangaDownloadGroup; index: number }) => {
    const isExpanded = expandedMangaIds.has(group.mangaId) || group.downloadingCount > 0;
    const sizeMB = (group.totalSizeBytes / (1024 * 1024)).toFixed(1);

    return (
      <AnimatedCard
        index={index}
        style={[
          styles.groupCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Accordion Header Row */}
        <Pressable
          onPress={() => toggleMangaExpand(group.mangaId)}
          style={styles.groupHeader}
        >
          <View style={[styles.coverContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {group.coverUrl ? (
              <Image source={{ uri: group.coverUrl }} style={styles.coverImage} contentFit="cover" transition={200} />
            ) : (
              <Ionicons name="book-outline" size={24} color={colors.textMuted} />
            )}
          </View>

          <View style={styles.groupInfo}>
            <Text style={[styles.mangaTitle, { color: colors.text }]} numberOfLines={1}>
              {group.mangaTitle}
            </Text>

            <View style={styles.groupMetaRow}>
              <Text style={[styles.groupMetaText, { color: colors.textSecondary }]}>
                {group.chapters.length} {group.chapters.length === 1 ? 'Chapter' : 'Chapters'} · {sizeMB} MB
              </Text>
              {group.downloadingCount > 0 && (
                <View style={[styles.downloadingBadge, { backgroundColor: colors.accentSubtle }]}>
                  <Text style={[styles.downloadingBadgeText, { color: colors.accent }]}>
                    Downloading ({group.downloadingCount})
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action Buttons & Dropdown Chevron */}
          <View style={styles.groupHeaderActions}>
            <Pressable
              onPress={() => handleDeleteMangaGroup(group)}
              hitSlop={8}
              style={styles.iconBtn}
            >
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={[styles.chevronBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.accent}
              />
            </View>
          </View>
        </Pressable>

        {/* Dropdown Chapter List Accordion */}
        {isExpanded && (
          <View style={[styles.chapterDropdown, { borderTopColor: colors.border }]}>
            {group.chapters.map((ch) => {
              const isCompleted = ch.status === 'completed';
              const isError = ch.status === 'error';
              const isDownloading = ch.status === 'downloading';
              const isPaused = ch.status === 'paused';
              const progressPercent = ch.totalFiles > 0 ? Math.round((ch.downloadedFiles / ch.totalFiles) * 100) : 0;
              const isSelected = selectedChapterIds.has(ch.chapterId);

              return (
                <View
                  key={ch.chapterId}
                  style={[
                    styles.subChapterItem,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.accentSubtle },
                  ]}
                >
                  {isSelecting && (
                    <Pressable
                      onPress={() => toggleChapterSelection(ch.chapterId)}
                      hitSlop={8}
                      style={styles.selectionCheck}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={isSelected ? colors.accent : colors.textMuted}
                      />
                    </Pressable>
                  )}

                  <View style={styles.subChapterInfo}>
                    <Text style={[styles.subChapterTitle, { color: colors.text }]} numberOfLines={1}>
                      Ch. {ch.chapterNum} {ch.chapterTitle ? `· ${ch.chapterTitle}` : ''}
                    </Text>

                    {isDownloading && (
                      <View style={styles.progressRow}>
                        <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceElevated }]}>
                          <View style={[styles.progressBarFill, { backgroundColor: colors.accent, width: `${progressPercent}%` }]} />
                        </View>
                        <Text style={[styles.progressText, { color: colors.accent }]}>
                          Downloading {ch.downloadedFiles}/{ch.totalFiles} ({progressPercent}%)
                        </Text>
                      </View>
                    )}

                    {isPaused && (
                      <View style={styles.progressRow}>
                        <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceElevated }]}>
                          <View style={[styles.progressBarFill, { backgroundColor: '#F59E0B', width: `${progressPercent}%` }]} />
                        </View>
                        <Text style={[styles.progressText, { color: '#F59E0B' }]}>
                          Paused · {ch.downloadedFiles}/{ch.totalFiles} ({progressPercent}%)
                        </Text>
                      </View>
                    )}

                    {isCompleted && (
                      <Text style={[styles.subMetaText, { color: colors.emerald }]}>
                        Saved Offline · {(ch.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                      </Text>
                    )}

                    {isError && (
                      <Text style={[styles.subMetaText, { color: '#EF4444' }]}>
                        Error: {ch.errorMessage || 'Failed'}
                      </Text>
                    )}
                  </View>

                  <View style={styles.subChapterActions}>
                    {isDownloading && (
                      <Pressable
                        onPress={() => handlePauseItem(ch)}
                        hitSlop={8}
                        style={styles.iconBtn}
                        accessibilityLabel="Pause chapter download"
                      >
                        <Ionicons name="pause-circle-outline" size={22} color={colors.accent} />
                      </Pressable>
                    )}

                    {isPaused && (
                      <Pressable
                        onPress={() => handleResumeItem(ch)}
                        hitSlop={8}
                        style={styles.iconBtn}
                        accessibilityLabel="Resume chapter download"
                      >
                        <Ionicons name="play-circle-outline" size={22} color="#F59E0B" />
                      </Pressable>
                    )}

                    {isError && (
                      <Pressable onPress={() => handleRetryItem(ch)} style={styles.iconBtn}>
                        <Ionicons name="refresh-outline" size={18} color={colors.accent} />
                      </Pressable>
                    )}

                    {isCompleted && (
                      <Pressable onPress={() => handleReadChapter(ch)} style={styles.iconBtn}>
                        <Ionicons name="play-circle-outline" size={22} color={colors.accent} />
                      </Pressable>
                    )}

                    <Pressable onPress={() => handleDeleteItem(ch)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </AnimatedCard>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[{ flex: 1, width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            {Platform.OS === 'web' && (
              <Pressable
                onPress={() => setDrawerVisible(true)}
                style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1 }]}
                hitSlop={8}
              >
                <Ionicons name="menu" size={26} color={colors.text} />
              </Pressable>
            )}
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {isSelecting ? `${selectedChapterIds.size} Selected` : 'Downloads'}
              </Text>
              <Text style={[styles.headerSubTitle, { color: colors.textSecondary }]}>
                {groupedManga.length} {groupedManga.length === 1 ? 'Manga' : 'Titles'} ({totalMB} MB total)
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {isSelecting ? (
              <>
                <Pressable
                  onPress={toggleSelectAllVisible}
                  style={[styles.folderConfigBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                >
                  <Ionicons
                    name={allVisibleSelected ? 'remove-circle-outline' : 'checkmark-done-outline'}
                    size={18}
                    color={colors.accent}
                  />
                  <Text style={[styles.folderConfigText, { color: colors.text }]}>
                    {allVisibleSelected ? 'Clear' : 'All'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleDeleteSelected}
                  style={[styles.folderConfigBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
                >
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
                  <Pressable
                    onPress={toggleSelectAllVisible}
                    style={[styles.folderConfigBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  >
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

        {/* Grouped Manga Downloads List */}
        <FlatList
          data={groupedManga}
          keyExtractor={(group) => group.mangaId}
          renderItem={renderMangaGroup}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-download-outline" size={54} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Downloads Found</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                {activeTab === 'completed'
                  ? 'You have no completed chapter downloads.'
                  : 'Downloaded chapters will appear here grouped by manga title.'}
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
                {Platform.OS === 'web'
                  ? 'Select a folder via your browser file picker, choose a preset, or specify a custom subfolder path:'
                  : "Open Android's native File Manager to select or create a folder, or enter a custom path manually:"}
              </Text>

              <AnimatedPressable
                onPress={handlePickFolder}
                style={[styles.pickFolderBtn, { backgroundColor: colors.accent }]}
              >
                <Ionicons name="folder-open" size={18} color="#FFFFFF" />
                <Text style={styles.pickFolderBtnText}>
                  {Platform.OS === 'web'
                    ? 'Browse Storage Folder'
                    : 'Browse Android Storage Folder'}
                </Text>
              </AnimatedPressable>

              {Platform.OS === 'web' && (
                <View style={{ gap: 6 }}>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Quick Presets:</Text>
                  <View style={styles.presetsRow}>
                    {[
                      { label: 'Default Vault', path: '' },
                      { label: 'downloads/yomite', path: 'downloads/yomite' },
                      { label: 'downloads/manga', path: 'downloads/manga' },
                    ].map((preset, idx) => {
                      const isSelected = customPathInput === preset.path;
                      return (
                        <Pressable
                          key={idx}
                          onPress={() => setCustomPathInput(preset.path)}
                          style={[
                            styles.presetChip,
                            {
                              backgroundColor: isSelected ? colors.accentSubtle : colors.surfaceElevated,
                              borderColor: isSelected ? colors.accent : colors.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name="folder-outline"
                            size={12}
                            color={isSelected ? colors.accent : colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.presetChipText,
                              { color: isSelected ? colors.accent : colors.textSecondary },
                            ]}
                          >
                            {preset.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={{ gap: 6, marginVertical: Spacing.xs }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Custom Directory Path:</Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text },
                  ]}
                  placeholder={Platform.OS === 'web' ? 'downloads/yomite' : '/storage/emulated/0/Download/Yomite'}
                  placeholderTextColor={colors.textMuted}
                  value={customPathInput}
                  onChangeText={setCustomPathInput}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalActionsRow}>
                <Pressable
                  onPress={() => setShowFolderModal(false)}
                  style={[
                    styles.modalBtn,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 },
                  ]}
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

        {/* Confirmation Modal */}
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

        {/* Hamburger Slide Drawer */}
        <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webCenteredContent: {
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  plainIconButton: {
    padding: 4,
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
    gap: Spacing.md,
  },

  /* Group Card */
  groupCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  coverContainer: {
    width: 46,
    height: 64,
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
  groupInfo: {
    flex: 1,
    gap: 4,
  },
  mangaTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  groupMetaText: {
    fontSize: Typography.sizes.footnote,
  },
  downloadingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  downloadingBadgeText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
  groupHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  chevronBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Sub Chapter Dropdown */
  chapterDropdown: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  subChapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  selectionCheck: {
    marginRight: 2,
  },
  subChapterInfo: {
    flex: 1,
    gap: 2,
  },
  subChapterTitle: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  subMetaText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
    marginTop: 2,
  },
  subChapterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
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
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
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
