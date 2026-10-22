/**
 * ReaderMenuDrawer — Official MangaDex Reader Side Control Menu
 * Features: Page/Chapter selectors with prev/next buttons, Scanlation group switcher,
 * Display mode toggles, fit modes, direction toggles, scanlation credits, and sharing.
 * Simplified flat modern design for Mobile with zero border widths and clean typography.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';
import type { ReadingMode } from '../types';
import { formatChapterDate } from '../utils/date';
import { BridgedImage } from './BridgedImage';
import { MobileModalRoot, MobileSheetPanel, MobileSheetPanelRef } from './MobileBottomSheet';
import { ShareCardModal } from './ShareCardModal';

interface ChapterOption {
  id: string;
  chapterNum: string;
  title: string;
  publishAt?: string;
  scanlator?: string;
  uploader?: string;
}

interface ReaderMenuDrawerProps {
  visible: boolean;
  onClose: () => void;
  mangaTitle: string;
  chapterTitle: string;
  uploaderName?: string;
  scanlationGroup?: string;
  currentChapterPublishAt?: string;
  currentPage: number;
  totalPages: number;
  onSelectPage: (pageIndex: number) => void;
  currentChapterId: string;
  pageUrls?: string[];
  pageHeaders?: Record<string, string>;
  chapters: ChapterOption[];
  onSelectChapter: (chapterId: string) => void;
  selectedScanlator?: string;
  availableScanlators?: { name: string; count: number }[];
  onSelectScanlator?: (scanlator: string) => void;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  readingMode: ReadingMode;
  onChangeReadingMode: (mode: ReadingMode) => void;
  imageFit: 'fit_both' | 'fit_width' | 'fit_height';
  onChangeImageFit: (fit: 'fit_both' | 'fit_width' | 'fit_height') => void;
  headerHidden: boolean;
  onToggleHeaderHidden: () => void;
  onGoBackToManga?: () => void;
  mobileSection?: 'chapters' | 'settings';
  mobileChapterViewMode?: 'list' | 'grid';
  onMobileChapterViewModeChange?: (mode: 'list' | 'grid') => void;
}

export function ReaderMenuDrawer({
  visible,
  onClose,
  mangaTitle,
  chapterTitle,
  uploaderName = 'MangaDex Uploader',
  scanlationGroup = 'Scanlation Team',
  currentChapterPublishAt,
  currentPage,
  totalPages,
  onSelectPage,
  currentChapterId,
  pageUrls = [],
  pageHeaders,
  chapters,
  onSelectChapter,
  selectedScanlator,
  availableScanlators = [],
  onSelectScanlator,
  hasPrevChapter,
  hasNextChapter,
  onPrevChapter,
  onNextChapter,
  readingMode,
  onChangeReadingMode,
  imageFit,
  onChangeImageFit,
  headerHidden,
  onToggleHeaderHidden,
  onGoBackToManga,
  mobileSection = 'settings',
  mobileChapterViewMode = 'list',
  onMobileChapterViewModeChange,
}: ReaderMenuDrawerProps) {
  const colors = useThemeColors();
  const mobileSheetRef = useRef<MobileSheetPanelRef>(null);

  const [showPagePicker, setShowPagePicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [showScanlatorPicker, setShowScanlatorPicker] = useState(false);
  const [showShareCardModal, setShowShareCardModal] = useState(false);
  const [pageFilter, setPageFilter] = useState('');
  const [pageSortAsc, setPageSortAsc] = useState(false);
  const [chapterFilter, setChapterFilter] = useState('');
  const [chapterSortAsc, setChapterSortAsc] = useState(false);
  const chapterViewTransition = useRef(new Animated.Value(1)).current;

  const pagesList = Array.from({ length: totalPages }, (_, idx) => idx);
  const filteredPages = pagesList
    .filter((idx) => {
      if (!pageFilter.trim()) return true;
      const q = pageFilter.trim();
      return (idx + 1).toString().includes(q);
    })
    .sort((a, b) => (pageSortAsc ? a - b : b - a));

  const filteredChapters = chapters
    .filter((ch) => {
      if (!chapterFilter.trim()) return true;
      const q = chapterFilter.trim().toLowerCase();
      return ch.chapterNum.toLowerCase().includes(q) || ch.title.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const numA = parseFloat(a.chapterNum) || 0;
      const numB = parseFloat(b.chapterNum) || 0;
      return chapterSortAsc ? numA - numB : numB - numA;
    });

  const getModeLabel = (mode: ReadingMode) => {
    switch (mode) {
      case 'webtoon':
        return 'Long Strip';
      case 'single':
        return 'Single Page';
      case 'double':
        return 'Double Page';
      case 'rtl':
        return 'Right To Left';
      case 'ltr':
        return 'Left To Right';
    }
  };

  const getModeIcon = (mode: ReadingMode): React.ComponentProps<typeof Ionicons>['name'] => {
    switch (mode) {
      case 'single':
        return 'tablet-portrait-outline';
      case 'webtoon':
        return 'reorder-four-outline';
      case 'rtl':
        return 'arrow-back-outline';
      case 'ltr':
        return 'arrow-forward-outline';
      case 'double':
        return 'albums-outline';
    }
  };

  const getFitLabel = (fit: 'fit_both' | 'fit_width' | 'fit_height') => {
    switch (fit) {
      case 'fit_both':
        return 'Fit Both';
      case 'fit_width':
        return 'Fit Width';
      case 'fit_height':
        return 'Fit Height';
    }
  };

  const isWeb = Platform.OS === 'web';
  const isMobileChapterList = !isWeb && mobileSection === 'chapters';
  const activeScanlatorName = selectedScanlator || scanlationGroup || 'Scanlation Group';
  const chapterViewMode = mobileChapterViewMode;
  const DrawerSurface = (isWeb ? View : MobileSheetPanel) as React.ComponentType<any>;
  const drawerSurfaceProps = isWeb
    ? {}
    : {
      ref: mobileSheetRef,
      visible,
      onClose,
      showHandle: true,
      gestureHandleOnly: true,
      style: [
        styles.mobileSheetPanel,
        { backgroundColor: colors.surface },
        mobileSection === 'chapters' ? styles.mobileChapterSheet : styles.mobileSettingsSheet,
      ],
    };

  useEffect(() => {
    if (!isMobileChapterList) return;
    chapterViewTransition.setValue(0);
    Animated.timing(chapterViewTransition, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [chapterViewMode, chapterViewTransition, isMobileChapterList]);

  const renderMobileChapterRows = () => (
    <View style={styles.mobileChapterRows}>
      {filteredChapters.map((ch) => {
        const isSelected = currentChapterId === ch.id;
        const scanlator = ch.scanlator?.trim();
        const activeGroup = activeScanlatorName?.trim();
        const uploader = ch.uploader?.trim() || uploaderName?.trim();
        const contributor =
          (scanlator && !/^no scanlation group$/i.test(scanlator) ? scanlator : null) ||
          (ch.uploader?.trim() && !/^(anonymous uploader|mangadex uploader)$/i.test(ch.uploader.trim())
            ? ch.uploader.trim()
            : null) ||
          (activeGroup && !/^(no scanlation group|scanlation group)$/i.test(activeGroup) ? activeGroup : null) ||
          (uploader && !/^(anonymous uploader|mangadex uploader)$/i.test(uploader) ? uploader : null);
        const metadata = [ch.publishAt ? formatChapterDate(ch.publishAt) : null, contributor]
          .filter(Boolean)
          .join(' • ');
        return (
          <Pressable
            key={ch.id}
            onPress={() => {
              onSelectChapter(ch.id);
              onClose();
            }}
            style={({ pressed }) => [
              styles.mobileChapterRow,
              isSelected && { backgroundColor: colors.accentSubtle },
              pressed && { opacity: 0.78 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={'Chapter ' + ch.chapterNum}
          >
            <View style={styles.mobileChapterRowText}>
              <Text
                style={[
                  styles.pickerItemText,
                  { color: isSelected ? colors.accent : colors.text },
                  isSelected && { fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {'Ch. ' + ch.chapterNum + (ch.title ? ' - ' + ch.title : '')}
              </Text>
              {metadata ? (
                <Text style={[styles.chapterDateSubtext, { color: colors.textMuted }]} numberOfLines={1}>
                  {metadata}
                </Text>
              ) : null}
            </View>
            {isSelected && <Ionicons name="checkmark" size={19} color={colors.accent} />}
          </Pressable>
        );
      })}
    </View>
  );

  const renderMobilePageGrid = () => (
    <View style={styles.mobilePageGrid}>
      {pageUrls.map((url, index) => (
        <Pressable
          key={url + '-' + index}
          onPress={() => {
            onSelectPage(index);
            onClose();
          }}
          style={({ pressed }) => [
            styles.mobilePageCard,
            currentPage === index && { borderColor: colors.accent, borderWidth: 2 },
            pressed && { opacity: 0.8 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={'Page ' + (index + 1)}
        >
          <BridgedImage
            source={{ uri: url, headers: pageHeaders }}
            style={styles.mobilePageImage}
            contentFit="cover"
            cachePolicy="disk"
          />
          <View
            style={[
              styles.mobilePageBadge,
              { backgroundColor: currentPage === index ? colors.accent : colors.surface },
            ]}
          >
            <Text style={[styles.mobilePageBadgeText, { color: currentPage === index ? colors.accentForeground : colors.text }]}>
              {index + 1}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );

  const renderMobileChapterList = () => (
    <ScrollView
      contentContainerStyle={styles.mobileChapterListContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <View style={styles.mobileSheetTabs}>
        <Pressable
          onPress={() => onMobileChapterViewModeChange?.('list')}
          style={styles.mobileSheetTab}
          accessibilityRole="button"
          accessibilityLabel="Show chapter list"
        >
          <Ionicons name="list-outline" size={27} color={chapterViewMode === 'list' ? colors.accent : colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => onMobileChapterViewModeChange?.('grid')}
          style={styles.mobileSheetTab}
          accessibilityRole="button"
          accessibilityLabel="Show page grid"
        >
          <Ionicons name="grid-outline" size={20} color={chapterViewMode === 'grid' ? colors.accent : colors.textMuted} />
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.mobileChapterContent,
          {
            opacity: chapterViewTransition,
            transform: [{
              translateX: chapterViewTransition.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            }],
          },
        ]}
      >
        {chapterViewMode === 'list' ? renderMobileChapterRows() : renderMobilePageGrid()}
      </Animated.View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType={isWeb ? 'fade' : 'none'}
      transparent
      onRequestClose={isWeb ? onClose : () => mobileSheetRef.current?.close()}
    >
      <MobileModalRoot style={[styles.backdrop, isWeb ? styles.webBackdrop : styles.mobileBackdrop]}>
        {!isWeb && <Pressable style={styles.overlayPress} onPress={() => mobileSheetRef.current?.close()} />}

        <DrawerSurface {...drawerSurfaceProps}>
          <View
            style={[
              styles.drawerContainer,
              { backgroundColor: colors.surface },
              !isWeb && styles.mobileDrawerContainer,
              isWeb && styles.webFloatingWindowContainer,
            ]}
          >
            <SafeAreaView style={styles.drawerInner}>
              {/* Header Bar */}
              <View style={[styles.drawerHeader, !isWeb && styles.mobileDrawerHeader, isWeb && styles.webFloatingHeader]}>
                {isWeb ? (
                  <View style={styles.headerLeftBtns}>
                    <Text style={[styles.headerTitleText, { color: colors.text }]}>
                      Reader Menu
                    </Text>
                  </View>
                ) : null}

                {isWeb ? (
                  <Pressable
                    onPress={onClose}
                    style={styles.iconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Close reader menu"
                  >
                    <Ionicons name="close" size={22} color={colors.text} />
                  </Pressable>
                ) : null}
              </View>

              {isMobileChapterList ? renderMobileChapterList() : <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!showPagePicker && !showChapterPicker && !showScanlatorPicker}
                nestedScrollEnabled
              >
                {/* Manga & Chapter Title Card */}
                <Pressable
                  onPress={onGoBackToManga}
                  disabled={!onGoBackToManga}
                  style={({ pressed }) => [
                    styles.titleCard,
                    { backgroundColor: colors.surfaceElevated },
                    pressed && onGoBackToManga && { opacity: 0.8 },
                  ]}
                >
                  <View style={styles.titleRow}>
                    <Text style={[styles.mangaTitleText, { color: colors.accent }]} numberOfLines={2}>
                      {mangaTitle}
                    </Text>
                    {onGoBackToManga && (
                      <Ionicons name="chevron-forward" size={16} color={colors.accent} style={{ marginTop: 2 }} />
                    )}
                  </View>
                  <Text style={[styles.chapterTitleText, { color: colors.text }]} numberOfLines={1}>
                    {chapterTitle}
                  </Text>
                </Pressable>

                {/* Scanlation Group Card / Selector (Aware of chosen group) */}
                {availableScanlators.length > 1 ? (
                  <View style={[styles.scanlatorWrapper, { backgroundColor: colors.surfaceElevated }]}>
                    <Pressable
                      onPress={() => setShowScanlatorPicker(!showScanlatorPicker)}
                      style={styles.scanlatorToggleBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Switch scanlation group"
                    >
                      <View style={styles.scanlatorInfoLeft}>
                        <Ionicons name="people" size={16} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>Scanlation Group</Text>
                          <Text style={[styles.scanlatorActiveText, { color: colors.text }]} numberOfLines={1}>
                            {activeScanlatorName}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.scanlatorBadgeRight}>
                        <Text style={[styles.scanlatorCountBadge, { color: colors.accent }]}>
                          {availableScanlators.length} groups
                        </Text>
                        <Ionicons
                          name={showScanlatorPicker ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={colors.textMuted}
                        />
                      </View>
                    </Pressable>

                    {/* Scanlation Groups Dropdown */}
                    {showScanlatorPicker && (
                      <View style={[styles.scanlatorPickerList, { backgroundColor: colors.surface }]}>
                        {availableScanlators.map((group) => {
                          const isSelected =
                            selectedScanlator === group.name ||
                            (!selectedScanlator && group.name === scanlationGroup);
                          return (
                            <Pressable
                              key={group.name}
                              onPress={() => {
                                onSelectScanlator?.(group.name);
                                setShowScanlatorPicker(false);
                              }}
                              style={[
                                styles.scanlatorItem,
                                isSelected && { backgroundColor: colors.accentSubtle },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.scanlatorItemText,
                                  { color: isSelected ? colors.accent : colors.text },
                                  isSelected && { fontWeight: '700' },
                                ]}
                                numberOfLines={1}
                              >
                                {group.name}
                              </Text>
                              <Text
                                style={[
                                  styles.scanlatorItemCount,
                                  { color: isSelected ? colors.accent : colors.textMuted },
                                ]}
                              >
                                {group.count} ch
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : null}

                {isWeb && <>
                {/* Page Navigation Selector */}
                <View style={styles.selectorRow}>
                  <Pressable
                    disabled={currentPage <= 0}
                    onPress={() => onSelectPage(currentPage - 1)}
                    style={[
                      styles.arrowBtn,
                      { backgroundColor: colors.surfaceElevated, opacity: currentPage <= 0 ? 0.3 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Previous page"
                  >
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </Pressable>

                  <Pressable
                    onPress={() => setShowPagePicker(!showPagePicker)}
                    style={[styles.dropdownBtn, { backgroundColor: colors.surfaceElevated }]}
                    accessibilityRole="button"
                    accessibilityLabel="Choose page"
                  >
                    <View style={styles.dropdownCol}>
                      <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>Page</Text>
                      <Text style={[styles.dropdownValue, { color: colors.text }]}>
                        {currentPage + 1} / {totalPages}
                      </Text>
                    </View>
                    <Ionicons name={showPagePicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </Pressable>

                  <Pressable
                    disabled={currentPage >= totalPages - 1}
                    onPress={() => onSelectPage(currentPage + 1)}
                    style={[
                      styles.arrowBtn,
                      { backgroundColor: colors.surfaceElevated, opacity: currentPage >= totalPages - 1 ? 0.3 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Next page"
                  >
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </Pressable>
                </View>

                {/* Page Picker Dropdown List */}
                {showPagePicker && (
                  <View style={[styles.pickerListContainer, { backgroundColor: colors.surfaceElevated }]}>
                    {/* Search & Sort Bar */}
                    <View style={[styles.chapterPickerHeader, { backgroundColor: colors.surface }]}>
                      <Ionicons name="search" size={15} color={colors.textMuted} />
                      <TextInput
                        style={[styles.chapterSearchInput, { color: colors.text }]}
                        placeholder="Search page #"
                        placeholderTextColor={colors.textMuted}
                        value={pageFilter}
                        onChangeText={(t) => setPageFilter(t.replace(/[\r\n]+/g, ' '))}
                        keyboardType="numeric"
                        multiline={false}
                        numberOfLines={1}
                      />
                      <Pressable
                        onPress={() => setPageSortAsc(!pageSortAsc)}
                        style={[styles.sortToggleBtn, { backgroundColor: colors.surfaceElevated }]}
                        accessibilityRole="button"
                        accessibilityLabel="Toggle page sort order"
                      >
                        <Ionicons
                          name={pageSortAsc ? 'arrow-up' : 'arrow-down'}
                          size={12}
                          color={colors.accent}
                        />
                        <Text style={[styles.sortToggleText, { color: colors.accent }]}>
                          {pageSortAsc ? `1→${totalPages}` : `${totalPages}→1`}
                        </Text>
                      </Pressable>
                    </View>

                    <ScrollView
                      style={{ maxHeight: 260 }}
                      showsVerticalScrollIndicator={true}
                      contentContainerStyle={{ padding: 6 }}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      scrollEnabled
                    >
                      {filteredPages.map((pageIdx) => (
                        <Pressable
                          key={pageIdx}
                          onPress={() => {
                            onSelectPage(pageIdx);
                            setShowPagePicker(false);
                          }}
                          style={[
                            styles.pickerItem,
                            currentPage === pageIdx && { backgroundColor: colors.accentSubtle },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pickerItemText,
                              { color: colors.text },
                              currentPage === pageIdx && { color: colors.accent, fontWeight: '700' },
                            ]}
                          >
                            Page {pageIdx + 1} of {totalPages}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Chapter Navigation Selector */}
                <View style={styles.selectorRow}>
                  <Pressable
                    disabled={!hasPrevChapter}
                    onPress={onPrevChapter}
                    style={[
                      styles.arrowBtn,
                      { backgroundColor: colors.surfaceElevated, opacity: !hasPrevChapter ? 0.3 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Previous chapter"
                  >
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </Pressable>

                  <Pressable
                    onPress={() => setShowChapterPicker(!showChapterPicker)}
                    style={[styles.dropdownBtn, { backgroundColor: colors.surfaceElevated }]}
                    accessibilityRole="button"
                    accessibilityLabel="Choose chapter"
                  >
                    <View style={styles.dropdownCol}>
                      <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>Chapter</Text>
                      <Text style={[styles.dropdownValue, { color: colors.text }]} numberOfLines={1}>
                        {chapterTitle}
                      </Text>
                    </View>
                    <Ionicons name={showChapterPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </Pressable>

                  <Pressable
                    disabled={!hasNextChapter}
                    onPress={onNextChapter}
                    style={[
                      styles.arrowBtn,
                      { backgroundColor: colors.surfaceElevated, opacity: !hasNextChapter ? 0.3 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Next chapter"
                  >
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </Pressable>
                </View>

                {/* Chapter Picker Dropdown List */}
                {showChapterPicker && (
                  <View style={[styles.pickerListContainer, { backgroundColor: colors.surfaceElevated }]}>
                    {/* Search & Sort Bar */}
                    <View style={[styles.chapterPickerHeader, { backgroundColor: colors.surface }]}>
                      <Ionicons name="search" size={15} color={colors.textMuted} />
                      <TextInput
                        style={[styles.chapterSearchInput, { color: colors.text }]}
                        placeholder="Search chapter #"
                        placeholderTextColor={colors.textMuted}
                        value={chapterFilter}
                        onChangeText={(t) => setChapterFilter(t.replace(/[\r\n]+/g, ' '))}
                        keyboardType="numeric"
                        multiline={false}
                        numberOfLines={1}
                      />
                      <Pressable
                        onPress={() => setChapterSortAsc(!chapterSortAsc)}
                        style={[styles.sortToggleBtn, { backgroundColor: colors.surfaceElevated }]}
                        accessibilityRole="button"
                        accessibilityLabel="Toggle chapter sort order"
                      >
                        <Ionicons
                          name={chapterSortAsc ? 'arrow-up' : 'arrow-down'}
                          size={12}
                          color={colors.accent}
                        />
                        <Text style={[styles.sortToggleText, { color: colors.accent }]}>
                          {chapterSortAsc ? 'Asc' : 'Desc'}
                        </Text>
                      </Pressable>
                    </View>

                    <ScrollView
                      style={{ maxHeight: 280 }}
                      showsVerticalScrollIndicator={true}
                      contentContainerStyle={{ padding: 6 }}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      scrollEnabled
                    >
                      {filteredChapters.map((ch) => (
                        <Pressable
                          key={ch.id}
                          onPress={() => {
                            onSelectChapter(ch.id);
                            setShowChapterPicker(false);
                          }}
                          style={[
                            styles.pickerItem,
                            currentChapterId === ch.id && {
                              backgroundColor: colors.accentSubtle,
                            },
                          ]}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={[
                                styles.pickerItemText,
                                { color: colors.text },
                                currentChapterId === ch.id && { color: colors.accent, fontWeight: '700' },
                              ]}
                              numberOfLines={1}
                            >
                              Ch. {ch.chapterNum} {ch.title ? `- ${ch.title}` : ''}
                            </Text>
                            {ch.publishAt ? (
                              <Text style={[styles.chapterDateSubtext, { color: colors.textMuted }]}>
                                {formatChapterDate(ch.publishAt)}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Uploaded By Credits Card */}
                <View style={[styles.uploaderSection, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.sectionHeaderLabel, { color: colors.textMuted }]}>CREDITS</Text>
                  <View style={styles.uploaderRow}>
                    <Ionicons name="people-outline" size={16} color={colors.accent} />
                    <Text style={[styles.uploaderGroupText, { color: colors.text }]}>{activeScanlatorName}</Text>
                  </View>
                  <View style={styles.uploaderRow}>
                    <Ionicons name="person-circle-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.uploaderUserText, { color: colors.textSecondary }]}>{uploaderName}</Text>
                  </View>
                  {currentChapterPublishAt ? (
                    <View style={styles.uploaderRow}>
                      <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                      <Text style={[styles.uploaderDateText, { color: colors.textMuted }]}>
                        {formatChapterDate(currentChapterPublishAt)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                </>}

                {/* Display Mode Toggles */}
                <Text style={[styles.sectionHeaderLabel, { color: colors.textMuted }]}>Reader display</Text>

                {/* Kotatsu-style direct reading mode selector */}
                <View style={styles.readerModeGrid}>
                  {(['single', 'webtoon', 'rtl', 'ltr'] as ReadingMode[]).map((mode) => {
                    const isSelected = readingMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => onChangeReadingMode(mode)}
                        style={({ pressed }) => [
                          styles.readerModeOption,
                          { backgroundColor: isSelected ? colors.accentSubtle : colors.surfaceElevated },
                          pressed && { opacity: 0.72 },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`Set reading mode to ${getModeLabel(mode)}`}
                      >
                        <Ionicons
                          name={getModeIcon(mode)}
                          size={24}
                          color={isSelected ? colors.accent : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.readerModeOptionText,
                            { color: isSelected ? colors.accent : colors.text },
                          ]}
                          numberOfLines={2}
                        >
                          {getModeLabel(mode)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Image Fit Button */}
                <Pressable
                  onPress={() => {
                    const fits: ('fit_both' | 'fit_width' | 'fit_height')[] = ['fit_both', 'fit_width', 'fit_height'];
                    const nextIdx = (fits.indexOf(imageFit) + 1) % fits.length;
                    onChangeImageFit(fits[nextIdx]);
                  }}
                  style={[styles.menuControlBtn, { backgroundColor: colors.surfaceElevated }]}
                  accessibilityRole="button"
                  accessibilityLabel="Change image fit"
                >
                  <Ionicons name="expand-outline" size={18} color={colors.text} />
                  <Text style={[styles.menuControlText, { color: colors.text }]}>{getFitLabel(imageFit)}</Text>
                  <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
                </Pressable>

                {/* Header Hidden Button */}
                <Pressable
                  onPress={onToggleHeaderHidden}
                  style={[styles.menuControlBtn, { backgroundColor: colors.surfaceElevated }]}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle header visibility"
                >
                  <Ionicons
                    name={headerHidden ? 'square-outline' : 'checkbox-outline'}
                    size={18}
                    color={colors.text}
                  />
                  <Text style={[styles.menuControlText, { color: colors.text }]}>
                    {headerHidden ? 'Header Hidden' : 'Header Shown'}
                  </Text>
                </Pressable>

                {/* Quick Community & Share Actions */}
                <View style={styles.navActionsContainer}>
                  <Pressable
                    onPress={() => setShowShareCardModal(true)}
                    style={({ pressed }) => [
                      styles.actionBtnRow,
                      { backgroundColor: colors.surfaceElevated },
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Share quote card"
                  >
                    <Ionicons name="share-social-outline" size={17} color={colors.accent} />
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Share Quote Card</Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                  </Pressable>

                </View>
              </ScrollView>}
            </SafeAreaView>
          </View>
        </DrawerSurface>

        {isWeb && <Pressable style={styles.overlayPress} onPress={onClose} />}

        <ShareCardModal
          visible={showShareCardModal}
          onClose={() => setShowShareCardModal(false)}
          mangaTitle={mangaTitle}
          chapterTitle={chapterTitle}
        />
      </MobileModalRoot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
  },
  webBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  mobileBackdrop: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  overlayPress: {
    flex: 1,
  },
  drawerContainer: {
    width: 320,
    height: '100%',
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.md,
  },
  mobileDrawerContainer: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  mobileSheetPanel: {
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  mobileChapterSheet: {
    height: '70%',
  },
  mobileSettingsSheet: {
    height: '70%',
  },
  drawerInner: {
    flex: 1,
  },
  webFloatingWindowContainer: {
    position: 'fixed' as any,
    top: 24,
    right: 24,
    bottom: 24,
    width: 380,
    maxHeight: 'calc(100vh - 48px)' as any,
    borderRadius: Radius.xl,
    boxShadow: '0 16px 32px rgba(0, 0, 0, 0.65)',
    elevation: 25,
    overflow: 'hidden',
    zIndex: 9999,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm + 4,
    marginBottom: Spacing.xs,
  },
  mobileSheetHandle: {
    width: 42,
    height: 5,
    borderRadius: Radius.full,
    alignSelf: 'center',
  },
  mobileDrawerHeader: {
    justifyContent: 'center',
    minHeight: 4,
    paddingVertical: 0,
    marginBottom: 0,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: Typography.weights.bold,
    marginLeft: 6,
  },
  webFloatingHeader: {
    paddingBottom: Spacing.sm,
  },
  headerLeftBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  scrollContent: {
    gap: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  mobileChapterListContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  mobileChapterRows: {
    gap: Spacing.xs,
  },
  mobileSheetTabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    borderRadius: Radius.md,
    gap: 3,
  },
  mobileSheetTab: {
    width: 44,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  mobileChapterContent: {
    flex: 1,
  },
  mobileChapterRow: {
    minHeight: 56,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileChapterRowText: {
    flex: 1,
    gap: 3,
  },
  mobilePageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  mobilePageCard: {
    width: '31%',
    aspectRatio: 0.68,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderColor: 'transparent',
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  mobilePageImage: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.surfaceElevated,
  },
  mobilePageBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  mobilePageBadgeText: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
  },
  titleCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  mangaTitleText: {
    fontSize: 16,
    fontWeight: Typography.weights.bold,
    lineHeight: 22,
    flex: 1,
  },
  chapterTitleText: {
    fontSize: 14,
    fontWeight: Typography.weights.medium,
  },
  scanlatorWrapper: {
    borderRadius: Radius.lg,
    borderWidth: 0,
    overflow: 'hidden',
  },
  scanlatorToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    minHeight: 48,
  },
  scanlatorInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  scanlatorActiveText: {
    fontSize: 14,
    fontWeight: Typography.weights.bold,
    marginTop: 1,
  },
  scanlatorBadgeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanlatorCountBadge: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
  },
  scanlatorPickerList: {
    padding: 6,
    gap: 4,
  },
  scanlatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  scanlatorItemText: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
    flex: 1,
  },
  scanlatorItemCount: {
    fontSize: 12,
    marginLeft: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  dropdownBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    borderWidth: 0,
  },
  dropdownCol: {
    justifyContent: 'center',
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dropdownValue: {
    fontSize: 14,
    fontWeight: Typography.weights.bold,
    marginTop: 1,
  },
  pickerListContainer: {
    borderRadius: Radius.lg,
    borderWidth: 0,
    maxHeight: 320,
    overflow: 'hidden',
  },
  chapterPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 40,
    maxHeight: 40,
    borderWidth: 0,
    gap: 8,
    overflow: 'hidden',
  },
  chapterSearchInput: {
    flex: 1,
    height: '100%',
    maxHeight: 40,
    fontSize: 14,
    paddingVertical: 0,
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  sortToggleText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
  pickerItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 0,
    marginVertical: 1,
  },
  pickerItemText: {
    fontSize: 14,
  },
  chapterDateSubtext: {
    fontSize: 12,
  },
  uploaderSection: {
    borderRadius: Radius.lg,
    borderWidth: 0,
    padding: Spacing.md,
    gap: 8,
  },
  uploaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploaderGroupText: {
    fontSize: 14,
    fontWeight: Typography.weights.bold,
  },
  uploaderUserText: {
    fontSize: 13,
  },
  uploaderDateText: {
    fontSize: 12,
  },
  sectionHeaderLabel: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.6,
    marginTop: 4,
  },
  readerModeGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  readerModeOption: {
    flex: 1,
    minHeight: 92,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: Spacing.sm,
    gap: 6,
  },
  readerModeOptionText: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
    textAlign: 'center',
    lineHeight: 14,
  },
  menuControlBtn: {
    height: 46,
    borderRadius: Radius.lg,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  menuControlText: {
    flex: 1,
    fontSize: 14,
    fontWeight: Typography.weights.semibold,
  },
  navActionsContainer: {
    gap: 8,
    marginVertical: 4,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 0,
    gap: Spacing.sm,
    minHeight: 46,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: Typography.weights.medium,
  },
});
