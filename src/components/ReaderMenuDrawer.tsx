/**
 * ReaderMenuDrawer — Official MangaDex Reader Side Control Menu
 * Features: Page/Chapter selectors with prev/next buttons, Scanlation group switcher,
 * Display mode toggles, Fit modes, Direction toggles, Scanlation credits, and Settings.
 * Simplified flat modern design for Mobile with zero border widths and clean typography.
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
  hapticsEnabled = true,
  onToggleHaptics,
  onOpenSettings,
  onGoBackToManga,
  onGoToHome,
}: ReaderMenuDrawerProps) {
  const colors = useThemeColors();

  const [showPagePicker, setShowPagePicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [showScanlatorPicker, setShowScanlatorPicker] = useState(false);
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
  const activeScanlatorName = selectedScanlator || scanlationGroup || 'Scanlation Group';

  return (
    <Modal
      visible={visible}
      animationType={isWeb ? 'fade' : 'none'}
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isWeb && styles.webBackdrop]}>
        {isWeb && <Pressable style={styles.overlayPress} onPress={onClose} />}

        <View
          style={[
            styles.drawerContainer,
            { backgroundColor: colors.surface },
            isWeb && styles.webFloatingWindowContainer,
          ]}
        >
          <SafeAreaView style={styles.drawerInner}>
            {/* Header Bar */}
            <View style={[styles.drawerHeader, isWeb && styles.webFloatingHeader]}>
              <View style={styles.headerLeftBtns}>
                {isWeb && onGoToHome && (
                  <Pressable
                    onPress={onGoToHome}
                    style={styles.iconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Back to Home"
                  >
                    <Ionicons name="home-outline" size={20} color={colors.text} />
                  </Pressable>
                )}
                <Text style={[styles.headerTitleText, !isWeb && { marginLeft: 0 }, { color: colors.text }]}>
                  Reader Menu
                </Text>
              </View>

              {isWeb ? (
                onOpenSettings && (
                  <Pressable
                    onPress={onOpenSettings}
                    style={styles.iconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Open Settings"
                  >
                    <Ionicons name="options-outline" size={20} color={colors.text} />
                  </Pressable>
                )
              ) : (
                <Pressable
                  onPress={onClose}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close reader menu"
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              )}
            </View>

            <ScrollView
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
                accessibilityRole="button"
                accessibilityLabel="Change reading mode"
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

              {/* Haptic Feedback Toggle */}
              <Pressable
                onPress={onToggleHaptics}
                style={[styles.menuControlBtn, { backgroundColor: colors.surfaceElevated }]}
                accessibilityRole="button"
                accessibilityLabel="Toggle haptic feedback"
              >
                <Ionicons
                  name={hapticsEnabled ? 'phone-portrait' : 'phone-portrait-outline'}
                  size={18}
                  color={hapticsEnabled ? colors.accent : colors.textMuted}
                />
                <Text style={[styles.menuControlText, { color: colors.text }]}>
                  Haptics: {hapticsEnabled ? 'ON' : 'OFF'}
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
                    { backgroundColor: colors.surfaceElevated },
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Chapter comments"
                >
                  <Ionicons name="chatbubbles-outline" size={17} color={colors.accent} />
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>Chapter Comments</Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                </Pressable>

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

                {onGoBackToManga && (
                  <Pressable
                    onPress={onGoBackToManga}
                    style={({ pressed }) => [
                      styles.actionBtnRow,
                      { backgroundColor: colors.surfaceElevated },
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Go to manga detail"
                  >
                    <Ionicons name="book-outline" size={17} color={colors.text} />
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Go to Manga Title</Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                  </Pressable>
                )}
                {onGoToHome && (
                  <Pressable
                    onPress={onGoToHome}
                    style={({ pressed }) => [
                      styles.actionBtnRow,
                      { backgroundColor: colors.surfaceElevated },
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Back to home"
                  >
                    <Ionicons name="home-outline" size={17} color={colors.text} />
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Back to Home Page</Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                  </Pressable>
                )}
              </View>

              {/* Reader Settings Modal Trigger */}
              <Pressable
                onPress={onOpenSettings}
                style={[styles.menuControlBtn, { backgroundColor: colors.surfaceElevated }]}
                accessibilityRole="button"
                accessibilityLabel="Open reader settings"
              >
                <Ionicons name="settings-outline" size={18} color={colors.accent} />
                <Text style={[styles.menuControlText, { color: colors.accent }]}>
                  Reader Settings
                </Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>

        {!isWeb && <Pressable style={styles.overlayPress} onPress={onClose} />}

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
    borderWidth: 0,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.md,
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
