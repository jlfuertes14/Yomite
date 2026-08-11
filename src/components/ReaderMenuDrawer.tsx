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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import type { ReadingMode } from '../types';

interface ChapterOption {
  id: string;
  chapterNum: string;
  title: string;
}

interface ReaderMenuDrawerProps {
  visible: boolean;
  onClose: () => void;
  mangaTitle: string;
  chapterTitle: string;
  uploaderName?: string;
  scanlationGroup?: string;
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
  const colors = Colors.dark;

  const [showPagePicker, setShowPagePicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [chapterFilter, setChapterFilter] = useState('');
  const [chapterSortAsc, setChapterSortAsc] = useState(false);

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.overlayPress} onPress={onClose} />

        <SafeAreaView style={[styles.drawerContainer, { backgroundColor: '#141417', borderColor: colors.border }]}>
          {/* Header Bar */}
          <View style={styles.drawerHeader}>
            <View style={styles.headerLeftBtns}>
              <Pressable onPress={onClose} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color="#FAFAFA" />
              </Pressable>
              {onGoBackToManga && (
                <Pressable onPress={onGoBackToManga} style={styles.iconBtn}>
                  <Ionicons name="arrow-back" size={20} color="#FAFAFA" />
                </Pressable>
              )}
              {onGoToHome && (
                <Pressable onPress={onGoToHome} style={styles.iconBtn}>
                  <Ionicons name="home-outline" size={20} color="#FAFAFA" />
                </Pressable>
              )}
            </View>
            <Pressable onPress={onOpenSettings} style={styles.iconBtn}>
              <Ionicons name="options" size={20} color="#FAFAFA" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Manga & Chapter Title (Clickable title navigates to Manga Details) */}
            <Pressable
              onPress={onGoBackToManga}
              disabled={!onGoBackToManga}
              style={({ pressed }) => [
                styles.infoSection,
                pressed && onGoBackToManga && { opacity: 0.7 },
              ]}
            >
              <View style={styles.titleRow}>
                <Text style={styles.mangaTitleText} numberOfLines={2}>
                  {mangaTitle}
                </Text>
                {onGoBackToManga && (
                  <Ionicons name="chevron-forward" size={16} color={colors.accent} style={{ marginTop: 2 }} />
                )}
              </View>
              <Text style={styles.chapterTitleText} numberOfLines={1}>
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
                  { opacity: currentPage <= 0 ? 0.3 : 1 },
                ]}
              >
                <Ionicons name="chevron-back" size={18} color="#FAFAFA" />
              </Pressable>

              <Pressable
                onPress={() => setShowPagePicker(!showPagePicker)}
                style={styles.dropdownBtn}
              >
                <View style={styles.dropdownCol}>
                  <Text style={styles.dropdownLabel}>Page</Text>
                  <Text style={styles.dropdownValue}>
                    {currentPage + 1} / {totalPages}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="#A1A1AA" />
              </Pressable>

              <Pressable
                disabled={currentPage >= totalPages - 1}
                onPress={() => onSelectPage(currentPage + 1)}
                style={[
                  styles.arrowBtn,
                  { opacity: currentPage >= totalPages - 1 ? 0.3 : 1 },
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color="#FAFAFA" />
              </Pressable>
            </View>

            {/* Page Picker Dropdown List */}
            {showPagePicker && (
              <View style={styles.pickerListContainer}>
                <ScrollView style={{ maxHeight: 150 }}>
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => {
                        onSelectPage(idx);
                        setShowPagePicker(false);
                      }}
                      style={[
                        styles.pickerItem,
                        currentPage === idx && styles.pickerItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          currentPage === idx && { color: colors.accent, fontWeight: 'bold' },
                        ]}
                      >
                        Page {idx + 1}
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
                  { opacity: !hasPrevChapter ? 0.3 : 1 },
                ]}
              >
                <Ionicons name="chevron-back" size={18} color="#FAFAFA" />
              </Pressable>

              <Pressable
                onPress={() => setShowChapterPicker(!showChapterPicker)}
                style={styles.dropdownBtn}
              >
                <View style={styles.dropdownCol}>
                  <Text style={styles.dropdownLabel}>Chapter</Text>
                  <Text style={styles.dropdownValue} numberOfLines={1}>
                    {chapterTitle}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="#A1A1AA" />
              </Pressable>

              <Pressable
                disabled={!hasNextChapter}
                onPress={onNextChapter}
                style={[
                  styles.arrowBtn,
                  { opacity: !hasNextChapter ? 0.3 : 1 },
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color="#FAFAFA" />
              </Pressable>
            </View>

            {/* Chapter Picker Dropdown List */}
            {showChapterPicker && (
              <View style={styles.pickerListContainer}>
                {/* Search & Sort Bar */}
                <View style={styles.chapterPickerHeader}>
                  <Ionicons name="search" size={14} color="#A1A1AA" />
                  <TextInput
                    style={styles.chapterSearchInput}
                    placeholder="Search chapter #"
                    placeholderTextColor="#71717A"
                    value={chapterFilter}
                    onChangeText={setChapterFilter}
                    keyboardType="numeric"
                  />
                  <Pressable
                    onPress={() => setChapterSortAsc(!chapterSortAsc)}
                    style={styles.sortToggleBtn}
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
                        currentChapterId === ch.id && styles.pickerItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          currentChapterId === ch.id && { color: colors.accent, fontWeight: 'bold' },
                        ]}
                        numberOfLines={1}
                      >
                        Ch. {ch.chapterNum} {ch.title ? `- ${ch.title}` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}



            {/* Uploaded By Credits */}
            <View style={styles.uploaderSection}>
              <Text style={styles.uploaderLabel}>Uploaded By</Text>
              <View style={styles.uploaderRow}>
                <Ionicons name="people-outline" size={16} color={colors.accent} />
                <Text style={styles.uploaderGroupText}>{scanlationGroup}</Text>
              </View>
              <View style={styles.uploaderRow}>
                <Ionicons name="person-circle-outline" size={16} color="#A1A1AA" />
                <Text style={styles.uploaderUserText}>{uploaderName}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Display Mode Toggles */}
            <Text style={styles.sectionHeaderLabel}>READER DISPLAY</Text>

            {/* Reading Mode Button */}
            <Pressable
              onPress={() => {
                const modes: ReadingMode[] = ['webtoon', 'single', 'double', 'rtl', 'ltr'];
                const nextIdx = (modes.indexOf(readingMode) + 1) % modes.length;
                onChangeReadingMode(modes[nextIdx]);
              }}
              style={styles.menuControlBtn}
            >
              <Ionicons name="document-text-outline" size={18} color="#FAFAFA" />
              <Text style={styles.menuControlText}>{getModeLabel(readingMode)}</Text>
              <Ionicons name="swap-horizontal" size={16} color="#A1A1AA" />
            </Pressable>

            {/* Image Fit Button */}
            <Pressable
              onPress={() => {
                const fits: ('fit_both' | 'fit_width' | 'fit_height')[] = ['fit_both', 'fit_width', 'fit_height'];
                const nextIdx = (fits.indexOf(imageFit) + 1) % fits.length;
                onChangeImageFit(fits[nextIdx]);
              }}
              style={styles.menuControlBtn}
            >
              <Ionicons name="expand-outline" size={18} color="#FAFAFA" />
              <Text style={styles.menuControlText}>{getFitLabel(imageFit)}</Text>
              <Ionicons name="swap-horizontal" size={16} color="#A1A1AA" />
            </Pressable>

            {/* Header Hidden Button */}
            <Pressable onPress={onToggleHeaderHidden} style={styles.menuControlBtn}>
              <Ionicons
                name={headerHidden ? 'square-outline' : 'checkbox-outline'}
                size={18}
                color="#FAFAFA"
              />
              <Text style={styles.menuControlText}>
                {headerHidden ? 'Header Hidden' : 'Header Shown'}
              </Text>
            </Pressable>

            {/* Haptic Feedback Toggle */}
            <Pressable onPress={onToggleHaptics} style={styles.menuControlBtn}>
              <Ionicons
                name={hapticsEnabled ? 'phone-portrait' : 'phone-portrait-outline'}
                size={18}
                color={hapticsEnabled ? colors.accent : '#A1A1AA'}
              />
              <Text style={styles.menuControlText}>
                Haptic Vibration: {hapticsEnabled ? 'ON' : 'OFF'}
              </Text>
              <Ionicons
                name={hapticsEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={hapticsEnabled ? colors.accent : '#A1A1AA'}
              />
            </Pressable>

            {/* Quick Navigation Actions */}
            {(onGoBackToManga || onGoToHome) && (
              <View style={styles.navActionsContainer}>
                {onGoBackToManga && (
                  <Pressable
                    onPress={onGoBackToManga}
                    style={({ pressed }) => [
                      styles.actionBtnRow,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="book-outline" size={16} color="#FAFAFA" />
                    <Text style={styles.actionBtnText}>Go to Manga Title</Text>
                    <Ionicons name="chevron-forward" size={14} color="#A1A1AA" style={{ marginLeft: 'auto' }} />
                  </Pressable>
                )}
                {onGoToHome && (
                  <Pressable
                    onPress={onGoToHome}
                    style={({ pressed }) => [
                      styles.actionBtnRow,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="home-outline" size={16} color="#FAFAFA" />
                    <Text style={styles.actionBtnText}>Back to Home Page</Text>
                    <Ionicons name="chevron-forward" size={14} color="#A1A1AA" style={{ marginLeft: 'auto' }} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Reader Settings Modal Trigger */}
            <Pressable onPress={onOpenSettings} style={[styles.menuControlBtn, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="settings-outline" size={18} color={colors.accent} />
              <Text style={[styles.menuControlText, { color: colors.accent }]}>
                Reader Settings
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
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
  overlayPress: {
    flex: 1,
  },
  drawerContainer: {
    width: 320,
    height: '100%',
    borderLeftWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
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
    backgroundColor: '#18181B',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: Spacing.sm,
  },
  actionBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
    color: '#FAFAFA',
  },
  mangaTitleText: {
    color: '#E11D48',
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
    lineHeight: 20,
  },
  chapterTitleText: {
    color: '#FAFAFA',
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
    backgroundColor: '#27272A',
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#27272A',
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
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
  },
  dropdownValue: {
    color: '#FAFAFA',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  pickerListContainer: {
    backgroundColor: '#18181B',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#27272A',
    maxHeight: 320,
    overflow: 'hidden',
  },
  chapterPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
    backgroundColor: '#141417',
    gap: 6,
  },
  chapterSearchInput: {
    flex: 1,
    height: 32,
    color: '#FAFAFA',
    fontSize: Typography.sizes.footnote,
    paddingVertical: 0,
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#27272A',
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
    borderBottomColor: '#27272A',
  },
  pickerItemActive: {
    backgroundColor: 'rgba(225,29,72,0.15)',
  },
  pickerItemText: {
    color: '#FAFAFA',
    fontSize: Typography.sizes.footnote,
  },
  actionBtnGroup: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  secondaryActionBtn: {
    height: 38,
    backgroundColor: '#27272A',
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  secondaryActionText: {
    color: '#D4D4D8',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },
  uploaderSection: {
    backgroundColor: '#18181B',
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 6,
  },
  uploaderLabel: {
    color: '#A1A1AA',
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
    color: '#FAFAFA',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  uploaderUserText: {
    color: '#A1A1AA',
    fontSize: Typography.sizes.footnote,
  },
  divider: {
    height: 1,
    backgroundColor: '#27272A',
    marginVertical: Spacing.xs,
  },
  sectionHeaderLabel: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  menuControlBtn: {
    height: 44,
    backgroundColor: '#27272A',
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  menuControlText: {
    flex: 1,
    color: '#FAFAFA',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
});
