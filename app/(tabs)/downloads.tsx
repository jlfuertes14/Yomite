import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Animated,
  Easing,
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
import { triggerHaptic } from '../../src/utils/haptics';
import { MobileModalRoot, MobileSheetPanel, MobileSheetPanelRef } from '../../src/components/MobileBottomSheet';

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
  const [folderRendered, setFolderRendered] = useState(false);
  const [customPathInput, setCustomPathInput] = useState('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());

  // Track expanded manga accordion cards
  const [expandedMangaIds, setExpandedMangaIds] = useState<Set<string>>(new Set());

  // Storage bottom sheet curtain animation
  const folderFadeAnim = useRef(new Animated.Value(0)).current;
  const folderSlideAnim = useRef(new Animated.Value(500)).current;
  const isClosingFolderRef = useRef(false);
  const folderSheetRef = useRef<MobileSheetPanelRef>(null);
  const pendingFolderCloseRef = useRef<(() => void) | null>(null);
  const isWeb = Platform.OS === 'web';

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

  const chapterList = useMemo(() => {
    return Object.values(chapters).sort(
      (a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime()
    );
  }, [chapters]);

  const totalDownloadingCount = useMemo(() => {
    return chapterList.filter(
      (c) => c.status === 'downloading' || c.status === 'pending' || c.status === 'paused'
    ).length;
  }, [chapterList]);

  const filteredChapters = useMemo(() => {
    return chapterList.filter((item) => {
      if (activeTab === 'completed') return item.status === 'completed';
      if (activeTab === 'in_progress')
        return (
          item.status === 'downloading' ||
          item.status === 'pending' ||
          item.status === 'paused' ||
          item.status === 'error'
        );
      return true;
    });
  }, [chapterList, activeTab]);

  // Group chapters by Manga
  const groupedManga: MangaDownloadGroup[] = useMemo(() => {
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
      if (ch.status === 'downloading' || ch.status === 'pending' || ch.status === 'paused')
        group.downloadingCount++;
      group.totalSizeBytes += ch.sizeBytes || 0;
    });

    return Array.from(map.values());
  }, [filteredChapters]);

  const activeDirectory = getDisplayDownloadDirectory();
  const isSelecting = selectedChapterIds.size > 0;
  const allVisibleSelected =
    filteredChapters.length > 0 &&
    filteredChapters.every((item) => selectedChapterIds.has(item.chapterId));

  const animateInFolder = useCallback(() => {
    folderFadeAnim.setValue(0);
    folderSlideAnim.setValue(500);
    Animated.parallel([
      Animated.timing(folderFadeAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(folderSlideAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [folderFadeAnim, folderSlideAnim]);

  const animateOutFolder = useCallback((callback?: () => void) => {
    if (isClosingFolderRef.current) return;
    isClosingFolderRef.current = true;
    Animated.parallel([
      Animated.timing(folderFadeAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(folderSlideAnim, {
        toValue: 500,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setFolderRendered(false);
      setShowFolderModal(false);
      isClosingFolderRef.current = false;
      callback?.();
    });
  }, [folderFadeAnim, folderSlideAnim]);

  useEffect(() => {
    if (showFolderModal) {
      setFolderRendered(true);
      if (isWeb) animateInFolder();
    } else if (folderRendered && !isClosingFolderRef.current) {
      if (isWeb) animateOutFolder();
      else setFolderRendered(false);
    }
  }, [showFolderModal, folderRendered, animateInFolder, animateOutFolder, isWeb]);

  const openFolderModal = useCallback(() => {
    triggerHaptic();
    setCustomPathInput(downloadDirectory || '');
    setShowFolderModal(true);
  }, [downloadDirectory]);

  const handleDismissFolderModal = () => {
    triggerHaptic();
    if (isWeb) animateOutFolder();
    else folderSheetRef.current?.close();
  };

  const handleNativeFolderDismissed = () => {
    setFolderRendered(false);
    setShowFolderModal(false);
    const callback = pendingFolderCloseRef.current;
    pendingFolderCloseRef.current = null;
    callback?.();
  };

  const toggleMangaExpand = (mangaId: string) => {
    triggerHaptic();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMangaIds((prev) => {
      const next = new Set(prev);
      if (next.has(mangaId)) next.delete(mangaId);
      else next.add(mangaId);
      return next;
    });
  };

  const toggleChapterSelection = (chapterId: string) => {
    triggerHaptic();
    setSelectedChapterIds((current) => {
      const next = new Set(current);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    triggerHaptic();
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

  const clearSelection = () => {
    triggerHaptic();
    setSelectedChapterIds(new Set());
  };

  const handlePickFolder = async () => {
    triggerHaptic();
    try {
      let selected: string | null = null;
      if (Platform.OS === 'android') {
        selected = await pickAndroidStorageDirectory();
      } else {
        selected = await pickStorageDirectory();
      }
      if (selected) {
        setCustomPathInput(selected);
      }
    } catch {
      // Ignored
    }
  };

  const handleSaveCustomDirectory = () => {
    triggerHaptic();
    const trimmed = customPathInput.trim();
    setCustomStorageDirectory(trimmed);
    const showSavedConfirmation = () => {
      setConfirmModalConfig({
        visible: true,
        title: 'Storage Location Saved',
        message: trimmed ? `Downloads will now save to:\n${trimmed}` : 'Reset to default storage directory.',
        iconName: 'folder-outline',
        confirmText: 'Done',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
    };
    if (isWeb) animateOutFolder(showSavedConfirmation);
    else {
      pendingFolderCloseRef.current = showSavedConfirmation;
      folderSheetRef.current?.close();
    }
  };

  const handleReadChapter = (item: DownloadedChapter) => {
    triggerHaptic();
    router.push(`/reader/${item.chapterId}?mangaId=${item.mangaId}` as any);
  };

  const handleDeleteItem = (item: DownloadedChapter) => {
    triggerHaptic();
    setConfirmModalConfig({
      visible: true,
      title: 'Delete Chapter',
      message: `Remove ${item.mangaTitle} Ch. ${item.chapterNum} from local storage?`,
      iconName: 'trash-outline',
      confirmText: 'Delete',
      confirmVariant: 'destructive',
      onConfirm: () => {
        removeDownloadedChapter(item.chapterId, item.mangaId);
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  const handleDeleteMangaGroup = (group: MangaDownloadGroup) => {
    triggerHaptic();
    setConfirmModalConfig({
      visible: true,
      title: `Delete ${group.mangaTitle}`,
      message: `Remove all ${group.chapters.length} downloaded chapters of "${group.mangaTitle}"?`,
      iconName: 'trash-outline',
      confirmText: 'Delete All',
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
    triggerHaptic();

    setConfirmModalConfig({
      visible: true,
      title: `Delete ${selected.length} ${selected.length === 1 ? 'Chapter' : 'Chapters'}`,
      message: `Remove the selected chapters from local storage?`,
      iconName: 'trash-outline',
      confirmText: 'Delete',
      confirmVariant: 'destructive',
      onConfirm: async () => {
        await Promise.all(selected.map((item) => removeDownloadedChapter(item.chapterId, item.mangaId)));
        clearSelection();
        setConfirmModalConfig((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  const handleRetryItem = (item: DownloadedChapter) => {
    triggerHaptic();
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
    triggerHaptic();
    pauseDownloadChapter(item.chapterId);
  };

  const handleResumeItem = (item: DownloadedChapter) => {
    triggerHaptic();
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

    return (
      <View
        style={[
          styles.groupCard,
          {
            borderBottomColor: colors.border,
          },
        ]}
      >
        {/* Accordion Header Row */}
        <Pressable
          onPress={() => toggleMangaExpand(group.mangaId)}
          style={styles.groupHeader}
          accessibilityRole="button"
          accessibilityLabel={`Toggle chapters for ${group.mangaTitle}`}
        >
          <View style={[styles.coverContainer, { backgroundColor: colors.surfaceElevated }]}>
            {group.coverUrl ? (
              <Image source={{ uri: group.coverUrl }} style={styles.coverImage} contentFit="cover" transition={150} />
            ) : (
              <Ionicons name="book-outline" size={20} color={colors.textMuted} />
            )}
          </View>

          <View style={styles.groupInfo}>
            <Text style={[styles.mangaTitle, { color: colors.text }]} numberOfLines={1}>
              {group.mangaTitle}
            </Text>

            <View style={styles.groupMetaRow}>
              <Text style={[styles.groupMetaText, { color: colors.textSecondary }]}>
                {group.chapters.length} {group.chapters.length === 1 ? 'Chapter' : 'Chapters'}
              </Text>
              {group.downloadingCount > 0 && (
                <View style={[styles.downloadingBadge, { backgroundColor: `${colors.accent}18` }]}>
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
              accessibilityRole="button"
              accessibilityLabel={`Delete all chapters of ${group.mangaTitle}`}
            >
              <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
            </Pressable>

            <View style={[styles.chevronBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={colors.textSecondary}
              />
            </View>
          </View>
        </Pressable>

        {/* Dropdown Chapter List Accordion */}
        {isExpanded && (
          <View style={styles.chapterDropdown}>
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
                    isSelected && { backgroundColor: colors.surfaceElevated },
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
                        size={19}
                        color={isSelected ? colors.text : colors.textMuted}
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
                        <Ionicons name="pause-circle-outline" size={20} color={colors.accent} />
                      </Pressable>
                    )}

                    {isPaused && (
                      <Pressable
                        onPress={() => handleResumeItem(ch)}
                        hitSlop={8}
                        style={styles.iconBtn}
                        accessibilityLabel="Resume chapter download"
                      >
                        <Ionicons name="play-circle-outline" size={20} color="#F59E0B" />
                      </Pressable>
                    )}

                    {isError && (
                      <Pressable onPress={() => handleRetryItem(ch)} style={styles.iconBtn}>
                        <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
                      </Pressable>
                    )}

                    {isCompleted && (
                      <Pressable onPress={() => handleReadChapter(ch)} style={styles.iconBtn}>
                        <Ionicons name="play-circle-outline" size={20} color={colors.text} />
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
      </View>
    );
  };

  const FolderBackdrop = (isWeb ? Animated.View : View) as any;
  const FolderSheet = (isWeb ? Animated.View : MobileSheetPanel) as any;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[{ flex: 1, width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>
        {/* Top Header Row matching modern design system */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            {Platform.OS === 'web' && (
              <Pressable
                onPress={() => setDrawerVisible(true)}
                style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1 }]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Open Navigation Menu"
              >
                <Ionicons name="menu" size={24} color={colors.text} />
              </Pressable>
            )}
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isSelecting ? `${selectedChapterIds.size} Selected` : 'Downloads'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {isSelecting ? (
              <>
                <Pressable
                  onPress={toggleSelectAllVisible}
                  style={[styles.headerActionPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                >
                  <Ionicons
                    name={allVisibleSelected ? 'remove-circle-outline' : 'checkmark-done-outline'}
                    size={15}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.headerActionPillText, { color: colors.text }]}>
                    {allVisibleSelected ? 'Clear' : 'All'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleDeleteSelected}
                  style={[styles.headerActionPill, { backgroundColor: '#EF444415', borderColor: colors.border }]}
                >
                  <Ionicons name="trash-outline" size={15} color="#EF4444" />
                  <Text style={[styles.headerActionPillText, { color: '#EF4444' }]}>Delete</Text>
                </Pressable>
                <Pressable onPress={clearSelection} hitSlop={8} style={styles.iconBtn}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </Pressable>
              </>
            ) : (
              <View style={styles.headerRightBox}>
                {filteredChapters.length > 0 && (
                  <Pressable
                    onPress={toggleSelectAllVisible}
                    style={({ pressed }) => [
                      styles.storagePillBtn,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Select chapters"
                  >
                    <Ionicons name="checkmark-circle-outline" size={13} color={colors.textSecondary} />
                    <Text style={[styles.storagePillText, { color: colors.text }]}>Select</Text>
                  </Pressable>
                )}
                {/* Storage Button matching HTML Prototype */}
                <Pressable
                  onPress={openFolderModal}
                  style={({ pressed }) => [
                    styles.storagePillBtn,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Change download location"
                >
                  <Ionicons name="folder-outline" size={13} color={colors.accent} />
                  <Text style={[styles.storagePillText, { color: colors.text }]}>Storage</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Filter Navigation Tabs (Segmented Control matching HTML Prototype) */}
        <View style={styles.tabsRow}>
          {[
            { id: 'all', label: 'All', hasDot: false },
            { id: 'completed', label: 'Completed', hasDot: false },
            { id: 'in_progress', label: 'Downloading', hasDot: totalDownloadingCount > 0 },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  triggerHaptic();
                  setActiveTab(tab.id as any);
                }}
                style={({ pressed }) => [
                  styles.tabPill,
                  isSelected
                    ? [styles.tabPillActive, { backgroundColor: colors.accent }]
                    : [styles.tabPillInactive, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }],
                  { transform: [{ scale: pressed ? 0.96 : 1 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${tab.label}`}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    isSelected
                      ? [styles.tabPillTextActive, { color: '#000000' }]
                      : [styles.tabPillTextInactive, { color: colors.textSecondary }],
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.hasDot && (
                  <View
                    style={[
                      styles.tabPillDot,
                      { backgroundColor: isSelected ? '#000000' : colors.accent },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Grouped Manga Downloads List or Rich Empty State */}
        <FlatList
          data={groupedManga}
          keyExtractor={(group) => group.mangaId}
          renderItem={renderMangaGroup}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {/* Concentric Radar Rings matching HTML Prototype */}
              <View style={styles.radarWrapper}>
                {/* Ambient Subtle Glow */}
                <View style={[styles.radarGlow, { backgroundColor: `${colors.accent}14` }]} />
                {/* Outer Dashed Radar Ring */}
                <View style={[styles.radarRingOuter, { borderColor: colors.border }]}>
                  {/* Inner Solid Circle */}
                  <View style={[styles.radarRingInner, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <Ionicons name="cloud-download-outline" size={38} color={colors.textSecondary} />
                  </View>
                  {/* Subtle Perimeter Indicator Badge */}
                  <View style={[styles.radarPerimeterBadge, { backgroundColor: `${colors.accent}25`, borderColor: colors.background }]}>
                    <View style={[styles.radarPerimeterDot, { backgroundColor: colors.accent }]} />
                  </View>
                </View>
              </View>

              {/* Title & Description */}
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Downloads Found</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                {activeTab === 'completed'
                  ? 'You have no completed chapter downloads.'
                  : activeTab === 'in_progress'
                  ? 'No active chapter downloads in progress.'
                  : 'Downloaded chapters will appear here grouped by manga title.'}
              </Text>

              {/* Primary Explore CTA */}
              <AnimatedPressable
                onPress={() => {
                  triggerHaptic();
                  router.push('/' as any);
                }}
                style={[styles.emptyExploreBtn, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Explore Manga"
              >
                <Ionicons name="compass-outline" size={17} color="#000000" />
                <Text style={styles.emptyExploreBtnText}>Explore Manga</Text>
              </AnimatedPressable>
            </View>
          }
        />

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            STORAGE LOCATION MODAL (Flat Curtain Bottom Sheet)
            Zero unnecessary text, clean presets, attached firmly to bottom
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {folderRendered && (
          <Modal
            visible={folderRendered}
            transparent
            animationType="none"
            onRequestClose={handleDismissFolderModal}
          >
            <MobileModalRoot style={styles.modalRoot}>
              {/* Animated Backdrop */}
              <FolderBackdrop
                pointerEvents="box-none"
                style={[styles.modalBackdrop, isWeb && { opacity: folderFadeAnim }]}
              >
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={handleDismissFolderModal}
                  accessibilityLabel="Close storage modal"
                />
              </FolderBackdrop>

              {/* Curtain Sheet (attached to bottom, slides up from 500 to 0) */}
              <FolderSheet
                ref={isWeb ? undefined : folderSheetRef}
                visible={isWeb ? undefined : folderRendered}
                onClose={isWeb ? undefined : handleNativeFolderDismissed}
                showHandle={isWeb ? undefined : true}
                style={[
                  styles.curtainSheet,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    ...(isWeb ? { transform: [{ translateY: folderSlideAnim }] } : {}),
                  },
                ]}
              >
                {/* Drag Handle */}
                {isWeb && <View style={styles.modalDragHandle} />}

                {/* Modal Header */}
                <View style={[styles.modalHeaderRow, { borderBottomColor: 'transparent' }]}>
                  <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>Storage Location</Text>
                </View>

                {/* Sheet Body Content */}
                <View style={styles.modalBody}>
                  {/* Current Storage Path Card */}
                  <View style={[styles.currentPathCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <View style={styles.pathHeaderRow}>
                      <Ionicons name="folder-open-outline" size={15} color={colors.accent} />
                      <Text style={[styles.pathLabelText, { color: colors.textMuted }]}>CURRENT DIRECTORY</Text>
                    </View>
                    <Text style={[styles.pathValueText, { color: colors.text }]} numberOfLines={2}>
                      {activeDirectory}
                    </Text>
                    <Pressable
                      onPress={handlePickFolder}
                      style={({ pressed }) => [
                        styles.browseStorageBtn,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Open directory picker"
                    >
                      <Ionicons name="file-tray-full-outline" size={15} color={colors.accent} />
                      <Text style={[styles.browseStorageBtnText, { color: colors.text }]}>
                        {Platform.OS === 'web' ? 'Select Folder from Browser' : 'Open Android File Manager'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Presets */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>QUICK PRESETS</Text>
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
                            onPress={() => {
                              triggerHaptic();
                              setCustomPathInput(preset.path);
                            }}
                            style={[
                              styles.presetPill,
                              {
                                backgroundColor: isSelected ? colors.surfaceElevated : colors.surface,
                                borderColor: isSelected ? 'rgba(255, 255, 255, 0.24)' : colors.border,
                              },
                            ]}
                          >
                            <Ionicons
                              name={isSelected ? 'checkmark-circle' : 'folder-outline'}
                              size={13}
                              color={isSelected ? colors.text : colors.textSecondary}
                            />
                            <Text
                              style={[
                                styles.presetPillText,
                                {
                                  color: isSelected ? colors.text : colors.textSecondary,
                                  fontWeight: isSelected ? '700' : '500',
                                },
                              ]}
                            >
                              {preset.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* Custom Path Input */}
                  <View style={styles.modalSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CUSTOM PATH</Text>
                    <TextInput
                      style={[
                        styles.customPathInput,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder={Platform.OS === 'web' ? 'downloads/yomite' : '/storage/emulated/0/Download/Yomite'}
                      placeholderTextColor={colors.textMuted}
                      value={customPathInput}
                      onChangeText={setCustomPathInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {/* Primary Save Button */}
                  <Pressable
                    onPress={handleSaveCustomDirectory}
                    style={({ pressed }) => [
                      styles.saveLocationBtn,
                      {
                        backgroundColor: colors.accent,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Save storage location"
                  >
                    <Text style={styles.saveLocationBtnText}>Save Location</Text>
                  </Pressable>
                </View>
              </FolderSheet>
            </MobileModalRoot>
          </Modal>
        )}

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
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storagePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 0,
  },
  storagePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  headerActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 0,
    marginRight: 6,
  },
  headerActionPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  iconBtn: {
    padding: 6,
  },

  /* Segmented Filter Navigation */
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  tabPillActive: {},
  tabPillInactive: {
    borderWidth: 0,
  },
  tabPillText: {
    fontSize: 12.5,
  },
  tabPillTextActive: {
    fontWeight: '700',
  },
  tabPillTextInactive: {
    fontWeight: '500',
  },
  tabPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },

  /* Group Card */
  groupCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: Spacing.md,
  },
  coverContainer: {
    width: 44,
    height: 62,
    borderRadius: 8,
    borderWidth: 0,
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
    fontSize: 15,
    fontWeight: '700',
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  groupMetaText: {
    fontSize: 12,
  },
  downloadingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  downloadingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  groupHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevronBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Sub Chapter Dropdown */
  chapterDropdown: {
    borderTopWidth: 0,
    paddingLeft: 56,
    paddingBottom: Spacing.xs,
  },
  subChapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    fontSize: 13,
    fontWeight: '600',
  },
  subMetaText: {
    fontSize: 11,
    fontWeight: '500',
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
    height: 3,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  progressText: {
    fontSize: 10.5,
    fontWeight: '600',
  },

  /* Empty State matching HTML Prototype */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 70,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  radarWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  radarGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  radarRingOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radarRingInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  radarPerimeterBadge: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPerimeterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 270,
    marginBottom: 24,
  },
  emptyExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyExploreBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Curtain Bottom Sheet Modal Styles */
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.36)',
  },
  curtainSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 0,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
    zIndex: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 24,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingTop: 16,
    gap: 16,
  },
  currentPathCard: {
    borderRadius: 14,
    borderWidth: 0,
    padding: 14,
    gap: 10,
  },
  pathHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pathLabelText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  pathValueText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  browseStorageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 0,
    marginTop: 2,
  },
  browseStorageBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  modalSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 0,
  },
  presetPillText: {
    fontSize: 12,
  },
  customPathInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  saveLocationBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveLocationBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
