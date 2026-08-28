/**
 * ReaderMenuDrawer — Official MangaDex Reader Side Control Menu
 * Features: Page/Chapter selectors with prev/next buttons, Display mode toggles,
 * Fit modes, Direction toggles, Scanlation credits, and Settings.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';
import { formatChapterDate } from '../utils/date';
import { ChapterCommentsModal } from './ChapterCommentsModal';
import { ShareCardModal } from './ShareCardModal';
import type { ReadingMode } from '../types';

interface ChapterOption {
  id: string;
  chapterNum: string;
  title: string;
  publishAt?: string;
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
  chapters: ChapterOption[];
  onSelectChapter: (chapterId: string) => void;
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
  hapticsEnabled?: boolean;
  onToggleHaptics?: () => void;
  onOpenSettings: () => void;
  onGoBackToManga?: () => void;
  onGoToHome?: () => void;
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
  chapters,
  onSelectChapter,
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
  hapticsEnabled = true,
  onToggleHaptics,
  onOpenSettings,
  onGoBackToManga,
  onGoToHome,
}: ReaderMenuDrawerProps) {
  const colors = useThemeColors();

  const [showPagePicker, setShowPagePicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showShareCardModal, setShowShareCardModal] = useState(false);
  const [pageFilter, setPageFilter] = useState('');
  const [pageSortAsc, setPageSortAsc] = useState(false);
  const [chapterFilter, setChapterFilter] = useState('');
  const [chapterSortAsc, setChapterSortAsc] = useState(false);

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

  return (
    <Modal
      visible={visible}
      animationType={isWeb ? 'fade' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isWeb && styles.webBackdrop]}>
        <Pressable style={styles.overlayPress} onPress={onClose} />

        <SafeAreaView
          style={[
            styles.drawerContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
            isWeb && styles.webFloatingWindowContainer,
          ]}
        >
          {/* Header Bar */}
          <View style={[styles.drawerHeader, isWeb && styles.webFloatingHeader]}>
            <View style={styles.headerLeftBtns}>
              <Pressable onPress={onClose} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
              {onGoToHome && (
                <Pressable onPress={onGoToHome} style={styles.iconBtn}>
                  <Ionicons name="home-outline" size={20} color={colors.text} />
                </Pressable>
              )}
            </View>
            <Pressable onPress={onOpenSettings} style={styles.iconBtn}>
              <Ionicons name="options" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Manga & Chapter Title */}
            <Pressable
              onPress={onGoBackToManga}
              disabled={!onGoBackToManga}
              style={({ pressed }) => [
                styles.infoSection,
                pressed && onGoBackToManga && { opacity: 0.7 },
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

            {/* Page Navigation Selector */}
            <View style={styles.selectorRow}>
              <Pressable
                disabled={currentPage <= 0}
                onPress={() => onSelectPage(currentPage - 1)}
                style={[
                  styles.arrowBtn,
                  { backgroundColor: colors.surfaceElevated, opacity: currentPage <= 0 ? 0.3 : 1 },
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>

              <Pressable
                onPress={() => setShowPagePicker(!showPagePicker)}
                style={[styles.dropdownBtn, { backgroundColor: colors.surfaceElevated }]}
              >
                <View style={styles.dropdownCol}>
                  <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Page</Text>
                  <Text style={[styles.dropdownValue, { color: colors.text }]}>
                    {currentPage + 1} / {totalPages}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </Pressable>

              <Pressable
                disabled={currentPage >= totalPages - 1}
                onPress={() => onSelectPage(currentPage + 1)}
                style={[
                  styles.arrowBtn,
                  { backgroundColor: colors.surfaceElevated, opacity: currentPage >= totalPages - 1 ? 0.3 : 1 },
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            </View>

            {/* Page Picker Dropdown List */}
            {showPagePicker && (
              <View style={[styles.pickerListContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Search & Sort Bar */}
                <View style={[styles.chapterPickerHeader, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border }]}>
                  <Ionicons name="search" size={14} color={colors.textMuted} />
                  <TextInput
                    style={[styles.chapterSearchInput, { color: colors.text }]}
                    placeholder="Search page #"
                    placeholderTextColor={colors.textMuted}
                    value={pageFilter}
                    onChangeText={setPageFilter}
                    keyboardType="numeric"
                  />
                  <Pressable
                    onPress={() => setPageSortAsc(!pageSortAsc)}
                    style={[styles.sortToggleBtn, { backgroundColor: colors.surface }]}
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

                <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                  {filteredPages.map((pageIdx) => (
                    <Pressable
                      key={pageIdx}
                      onPress={() => {
                        onSelectPage(pageIdx);
                        setShowPagePicker(false);
                      }}
                      style={[
                        styles.pickerItem,
                        { borderBottomColor: colors.borderSubtle },
                        currentPage === pageIdx && styles.pickerItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          { color: colors.text },
                          currentPage === pageIdx && { color: colors.accent, fontWeight: 'bold' },
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
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>

              <Pressable
                onPress={() => setShowChapterPicker(!showChapterPicker)}
                style={[styles.dropdownBtn, { backgroundColor: colors.surfaceElevated }]}
              >
                <View style={styles.dropdownCol}>
                  <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Chapter</Text>
                  <Text style={[styles.dropdownValue, { color: colors.text }]} numberOfLines={1}>
                    {chapterTitle}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </Pressable>

              <Pressable
                disabled={!hasNextChapter}
                onPress={onNextChapter}
                style={[
                  styles.arrowBtn,
                  { backgroundColor: colors.surfaceElevated, opacity: !hasNextChapter ? 0.3 : 1 },
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            </View>

            {/* Chapter Picker Dropdown List */}
            {showChapterPicker && (
              <View style={[styles.pickerListContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Search & Sort Bar */}
                <View style={[styles.chapterPickerHeader, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border }]}>
                  <Ionicons name="search" size={14} color={colors.textMuted} />
                  <TextInput
                    style={[styles.chapterSearchInput, { color: colors.text }]}
                    placeholder="Search chapter #"
                    placeholderTextColor={colors.textMuted}
                    value={chapterFilter}
                    onChangeText={setChapterFilter}
                    keyboardType="numeric"
                  />
                  <Pressable
                    onPress={() => setChapterSortAsc(!chapterSortAsc)}
                    style={[styles.sortToggleBtn, { backgroundColor: colors.surface }]}
                  >
                    <Ionicons
                      name={chapterSortAsc ? 'arrow-up' : 'arrow-down'}
                      size={12}
                      color={colors.accent}
                    />
                    <Text style={[styles.sortToggleText, { color: colors.accent }]}>
                      {chapterSortAsc ? '1→59' : '59→1'}
                    </Text>
                  </Pressable>
                </View>

                <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                  {filteredChapters.map((ch) => (
                    <Pressable
                      key={ch.id}
                      onPress={() => {
                        onSelectChapter(ch.id);
                        setShowChapterPicker(false);
                      }}
                      style={[
                        styles.pickerItem,
                        { borderBottomColor: colors.borderSubtle },
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
                            currentChapterId === ch.id && { color: colors.accent, fontWeight: 'bold' },
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

            {/* Uploaded By Credits */}
            <View style={[styles.uploaderSection, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.uploaderLabel, { color: colors.textMuted }]}>Uploaded By</Text>
              <View style={styles.uploaderRow}>
                <Ionicons name="people-outline" size={16} color={colors.accent} />
                <Text style={[styles.uploaderGroupText, { color: colors.text }]}>{scanlationGroup}</Text>
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

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Display Mode Toggles */}
            <Text style={[styles.sectionHeaderLabel, { color: colors.textMuted }]}>READER DISPLAY</Text>

            {/* Reading Mode Button */}
            <Pressable
              onPress={() => {
                const modes: ReadingMode[] = ['webtoon', 'single', 'double', 'rtl', 'ltr'];
                const nextIdx = (modes.indexOf(readingMode) + 1) % modes.length;
                onChangeReadingMode(modes[nextIdx]);
              }}
              style={[styles.menuControlBtn, { backgroundColor: colors.surfaceElevated }]}
            >
              <Ionicons name="document-text-outline" size={18} color={colors.text} />
              <Text style={[styles.menuControlText, { color: colors.text }]}>{getModeLabel(readingMode)}</Text>
              <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
            </Pressable>

            {/* Image Fit Button */}
            <Pressable
              onPress={() => {
                const fits: ('fit_both' | 'fit_width' | 'fit_height')[] = ['fit_both', 'fit_width', 'fit_height'];
                const nextIdx = (fits.indexOf(imageFit) + 1) % fits.length;
                onChangeImageFit(fits[nextIdx]);
              }}
              style={[styles.menuControlBtn, { backgroundColor: colors.surfaceElevated }]}
            >
              <Ionicons name="expand-outline" size={18} color={colors.text} />
              <Text style={[styles.menuControlText, { color: colors.text }]}>{getFitLabel(imageFit)}</Text>
              <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
            </Pressable>

            {/* Header Hidden Button */}
            <Pressable
              onPress={onToggleHeaderHidden}
              style={[styles.menuControlBtn, { backgroundColor: colors.surfaceElevated }]}
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

            {/* Haptic Feedback Toggle */}
            <Pressable
              onPress={onToggleHaptics}
              style={[styles.menuControlBtn, { backgroundColor: colors.surfaceElevated }]}
            >
              <Ionicons
                name={hapticsEnabled ? 'phone-portrait' : 'phone-portrait-outline'}
                size={18}
                color={hapticsEnabled ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.menuControlText, { color: colors.text }]}>
                Haptic Vibration: {hapticsEnabled ? 'ON' : 'OFF'}
              </Text>
              <Ionicons
                name={hapticsEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={hapticsEnabled ? colors.accent : colors.textMuted}
              />
            </Pressable>

            {/* Quick Community & Share Actions */}
            <View style={styles.navActionsContainer}>
              <Pressable
                onPress={() => setShowCommentsModal(true)}
                style={({ pressed }) => [
                  styles.actionBtnRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="chatbubbles-outline" size={16} color={colors.accent} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Chapter Comments</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
              </Pressable>

              <Pressable
                onPress={() => setShowShareCardModal(true)}
                style={({ pressed }) => [
                  styles.actionBtnRow,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="share-social-outline" size={16} color={colors.accent} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Share Quote Card</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
              </Pressable>

              {onGoBackToManga && (
                <Pressable
                  onPress={onGoBackToManga}
                  style={({ pressed }) => [
                    styles.actionBtnRow,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="book-outline" size={16} color={colors.text} />
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>Go to Manga Title</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                </Pressable>
              )}
              {onGoToHome && (
                <Pressable
                  onPress={onGoToHome}
                  style={({ pressed }) => [
                    styles.actionBtnRow,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="home-outline" size={16} color={colors.text} />
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>Back to Home Page</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                </Pressable>
              )}
            </View>

            {/* Reader Settings Modal Trigger */}
            <Pressable onPress={onOpenSettings} style={[styles.menuControlBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="settings-outline" size={18} color={colors.accent} />
              <Text style={[styles.menuControlText, { color: colors.accent }]}>
                Reader Settings
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>

        {/* Modals */}
        <ChapterCommentsModal
          visible={showCommentsModal}
          onClose={() => setShowCommentsModal(false)}
          chapterId={currentChapterId}
          chapterTitle={chapterTitle}
        />

        <ShareCardModal
          visible={showShareCardModal}
          onClose={() => setShowShareCardModal(false)}
          mangaTitle={mangaTitle}
          chapterTitle={chapterTitle}
        />
      </View>
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
  overlayPress: {
    flex: 1,
  },
  drawerContainer: {
    width: 320,
    height: '100%',
    borderLeftWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  webFloatingWindowContainer: {
    position: 'fixed' as any,
    top: 24,
    right: 24,
    bottom: 24,
    width: 380,
    maxHeight: 'calc(100vh - 48px)' as any,
    borderRadius: Radius.xl,
    borderWidth: 1,
    boxShadow: '0 16px 32px rgba(0, 0, 0, 0.65)',
    elevation: 25,
    overflow: 'hidden',
    zIndex: 9999,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  webFloatingHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: Spacing.sm,
  },
  webHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  webStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F43F5E',
  },
  webHeaderBadgeText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: '#F43F5E',
    letterSpacing: 0.4,
  },
  headerLeftBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  iconBtn: {
    padding: 6,
  },
  scrollContent: {
    gap: Spacing.md,
    paddingBottom: Spacing['2xl'],
  },
  infoSection: {
    gap: 4,
    marginBottom: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  navActionsContainer: {
    gap: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  actionBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },
  mangaTitleText: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
    lineHeight: 20,
  },
  chapterTitleText: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowBtn: {
    width: 38,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownBtn: {
    flex: 1,
    height: 42,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  dropdownCol: {
    justifyContent: 'center',
  },
  dropdownLabel: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
  },
  dropdownValue: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  pickerListContainer: {
    borderRadius: Radius.md,
    borderWidth: 1,
    maxHeight: 320,
    overflow: 'hidden',
  },
  chapterPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 6,
  },
  chapterSearchInput: {
    flex: 1,
    height: 32,
    fontSize: Typography.sizes.footnote,
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
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  pickerItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
  },
  pickerItemActive: {
    backgroundColor: 'rgba(225,29,72,0.15)',
  },
  pickerItemText: {
    fontSize: Typography.sizes.footnote,
  },
  chapterDateSubtext: {
    fontSize: 10,
  },
  uploaderSection: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 6,
  },
  uploaderLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
  },
  uploaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploaderGroupText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  uploaderUserText: {
    fontSize: Typography.sizes.footnote,
  },
  uploaderDateText: {
    fontSize: Typography.sizes.caption,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.xs,
  },
  sectionHeaderLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  menuControlBtn: {
    height: 44,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  menuControlText: {
    flex: 1,
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
});
