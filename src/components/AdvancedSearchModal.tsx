/**
 * AdvancedSearchModal — Full MangaDex Filter & Advanced Search Modal
 * Responsive dialog modal on Web (floating centered card with backdrop)
 * and sleek sheet/fullscreen modal on mobile.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../hooks/useThemeColor';
import { getTags } from '../api/mangadex';
import type { MangaTag, SearchFilters } from '../types';

interface AdvancedSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: SearchFilters) => void;
  onRandomManga?: () => void;
}

const CONTENT_RATINGS: { key: 'safe' | 'suggestive' | 'erotica' | 'pornographic'; label: string }[] = [
  { key: 'safe', label: 'Safe' },
  { key: 'suggestive', label: 'Suggestive' },
  { key: 'erotica', label: 'Erotica' },
  { key: 'pornographic', label: 'Pornographic' },
];

const STATUSES: { key: 'ongoing' | 'completed' | 'cancelled' | 'hiatus'; label: string }[] = [
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'hiatus', label: 'Hiatus' },
];

const DEMOGRAPHICS: { key: 'shounen' | 'shoujo' | 'josei' | 'seinen'; label: string }[] = [
  { key: 'shounen', label: 'Shounen' },
  { key: 'shoujo', label: 'Shoujo' },
  { key: 'seinen', label: 'Seinen' },
  { key: 'josei', label: 'Josei' },
];

// Exact 13 MangaDex Sort Options
export interface SortOptionItem {
  id: string;
  label: string;
  sort: SearchFilters['sort'];
  order: SearchFilters['order'];
}

const MANGADEX_SORT_OPTIONS: SortOptionItem[] = [
  { id: 'best_match', label: 'Best Match', sort: 'relevance', order: 'desc' },
  { id: 'latest_upload', label: 'Latest Upload', sort: 'latestUploadedChapter', order: 'desc' },
  { id: 'oldest_upload', label: 'Oldest Upload', sort: 'latestUploadedChapter', order: 'asc' },
  { id: 'title_asc', label: 'Title Ascending', sort: 'title', order: 'asc' },
  { id: 'title_desc', label: 'Title Descending', sort: 'title', order: 'desc' },
  { id: 'highest_rating', label: 'Highest Rating', sort: 'rating', order: 'desc' },
  { id: 'lowest_rating', label: 'Lowest Rating', sort: 'rating', order: 'asc' },
  { id: 'most_follows', label: 'Most Follows', sort: 'followedCount', order: 'desc' },
  { id: 'fewest_follows', label: 'Fewest Follows', sort: 'followedCount', order: 'asc' },
  { id: 'recently_added', label: 'Recently Added', sort: 'createdAt', order: 'desc' },
  { id: 'oldest_added', label: 'Oldest Added', sort: 'createdAt', order: 'asc' },
  { id: 'year_asc', label: 'Year Ascending', sort: 'year', order: 'asc' },
  { id: 'year_desc', label: 'Year Descending', sort: 'year', order: 'desc' },
];

const GROUP_ORDER = [
  { key: 'format', label: 'Format' },
  { key: 'genre', label: 'Genre' },
  { key: 'theme', label: 'Theme' },
  { key: 'content', label: 'Content' },
];

export function AdvancedSearchModal({
  visible,
  onClose,
  onApplyFilters,
  onRandomManga,
}: AdvancedSearchModalProps) {
  const colors = useThemeColors();

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<MangaTag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  // Active Sort Option
  const [activeSortId, setActiveSortId] = useState<string>('most_follows');

  // Filters state
  const [includedTags, setIncludedTags] = useState<string[]>([]);
  const [excludedTags, setExcludedTags] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<('safe' | 'suggestive' | 'erotica' | 'pornographic')[]>([
    'safe',
    'suggestive',
  ]);
  const [selectedStatus, setSelectedStatus] = useState<('ongoing' | 'completed' | 'cancelled' | 'hiatus')[]>([]);
  const [selectedDemographic, setSelectedDemographic] = useState<('shounen' | 'shoujo' | 'josei' | 'seinen')[]>([]);

  useEffect(() => {
    if (visible && tags.length === 0) {
      loadTags();
    }
  }, [visible]);

  const loadTags = async () => {
    try {
      setIsLoadingTags(true);
      const tagData = await getTags();
      setTags(tagData);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const groupedTags = useMemo(() => {
    const map: Record<string, MangaTag[]> = {
      format: [],
      genre: [],
      theme: [],
      content: [],
    };

    tags.forEach((tag) => {
      const group = tag.attributes.group?.toLowerCase() ?? 'genre';
      if (!map[group]) map[group] = [];
      map[group].push(tag);
    });

    Object.keys(map).forEach((g) => {
      map[g].sort((a, b) => {
        const nameA = a.attributes.name.en ?? Object.values(a.attributes.name)[0] ?? '';
        const nameB = b.attributes.name.en ?? Object.values(b.attributes.name)[0] ?? '';
        return nameA.localeCompare(nameB);
      });
    });

    return map;
  }, [tags]);

  const toggleRating = (rating: 'safe' | 'suggestive' | 'erotica' | 'pornographic') => {
    setSelectedRatings((prev) =>
      prev.includes(rating) ? prev.filter((r) => r !== rating) : [...prev, rating]
    );
  };

  const toggleStatus = (status: 'ongoing' | 'completed' | 'cancelled' | 'hiatus') => {
    setSelectedStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleDemographic = (demo: 'shounen' | 'shoujo' | 'josei' | 'seinen') => {
    setSelectedDemographic((prev) =>
      prev.includes(demo) ? prev.filter((d) => d !== demo) : [...prev, demo]
    );
  };

  const toggleTag = (tagId: string) => {
    if (includedTags.includes(tagId)) {
      setIncludedTags((prev) => prev.filter((id) => id !== tagId));
      setExcludedTags((prev) => [...prev, tagId]);
    } else if (excludedTags.includes(tagId)) {
      setExcludedTags((prev) => prev.filter((id) => id !== tagId));
    } else {
      setIncludedTags((prev) => [...prev, tagId]);
    }
  };

  const handleReset = () => {
    setTitle('');
    setActiveSortId('most_follows');
    setIncludedTags([]);
    setExcludedTags([]);
    setSelectedRatings(['safe', 'suggestive']);
    setSelectedStatus([]);
    setSelectedDemographic([]);
  };

  const handleApply = () => {
    const selectedSortOpt = MANGADEX_SORT_OPTIONS.find((o) => o.id === activeSortId) || MANGADEX_SORT_OPTIONS[0];

    onApplyFilters({
      title: title.trim() || undefined,
      includedTags: includedTags.length ? includedTags : undefined,
      excludedTags: excludedTags.length ? excludedTags : undefined,
      contentRating: selectedRatings.length ? selectedRatings : ['safe', 'suggestive'],
      status: selectedStatus.length ? selectedStatus : undefined,
      publicationDemographic: selectedDemographic.length ? selectedDemographic : undefined,
      sort: selectedSortOpt.sort,
      order: selectedSortOpt.order,
    });
    onClose();
  };

  const isWeb = Platform.OS === 'web';

  const modalBody = (
    <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Modal Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Advanced Search
        </Text>
        <View style={styles.headerRight}>
          <Pressable onPress={handleReset} style={styles.resetBtn}>
            <Text style={[styles.resetBtnText, { color: colors.accent }]}>Reset</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Input */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Title / Keywords</Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          placeholder="Search title or keywords..."
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        {/* MangaDex Official 13 Sort Options */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Sort By</Text>
        <View style={styles.chipRow}>
          {MANGADEX_SORT_OPTIONS.map((opt) => {
            const active = activeSortId === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setActiveSortId(opt.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.text : colors.surfaceElevated,
                    borderColor: active ? colors.text : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? colors.background : colors.textSecondary }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Content Rating */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Content Rating</Text>
        <View style={styles.chipRow}>
          {CONTENT_RATINGS.map((r) => {
            const active = selectedRatings.includes(r.key);
            return (
              <Pressable
                key={r.key}
                onPress={() => toggleRating(r.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.surfaceElevated : colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? colors.accent : colors.textSecondary }]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Publication Status */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Publication Status</Text>
        <View style={styles.chipRow}>
          {STATUSES.map((s) => {
            const active = selectedStatus.includes(s.key);
            return (
              <Pressable
                key={s.key}
                onPress={() => toggleStatus(s.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.surfaceElevated : colors.surface,
                    borderColor: active ? colors.text : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? colors.text : colors.textSecondary }]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Demographic */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Magazine Demographic</Text>
        <View style={styles.chipRow}>
          {DEMOGRAPHICS.map((d) => {
            const active = selectedDemographic.includes(d.key);
            return (
              <Pressable
                key={d.key}
                onPress={() => toggleDemographic(d.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.surfaceElevated : colors.surface,
                    borderColor: active ? colors.text : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? colors.text : colors.textSecondary }]}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Grouped Tags (Format, Genre, Theme, Content) */}
        <View style={styles.tagHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Tags & Genres</Text>
          <Text style={[styles.tagHelpText, { color: colors.textMuted }]}>
            Tap: Include (+) / Exclude (-)
          </Text>
        </View>

        {isLoadingTags ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
        ) : (
          GROUP_ORDER.map((group) => {
            const groupTagList = groupedTags[group.key] ?? [];
            if (groupTagList.length === 0) return null;

            return (
              <View key={group.key} style={styles.tagGroupBlock}>
                <View style={styles.groupHeaderRow}>
                  <Text style={[styles.groupHeaderText, { color: colors.text }]}>
                    {group.label}
                  </Text>
                  <View style={[styles.groupHeaderLine, { backgroundColor: colors.border }]} />
                </View>

                <View style={styles.chipRow}>
                  {groupTagList.map((t) => {
                    const isInc = includedTags.includes(t.id);
                    const isExc = excludedTags.includes(t.id);
                    const tagName = t.attributes.name.en ?? Object.values(t.attributes.name)[0];
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => toggleTag(t.id)}
                        style={[
                          styles.tagChip,
                          {
                            backgroundColor: isInc
                              ? 'rgba(16,185,129,0.18)'
                              : isExc
                              ? 'rgba(244,63,94,0.18)'
                              : colors.surfaceElevated,
                            borderColor: isInc
                              ? colors.emerald
                              : isExc
                              ? colors.accent
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tagChipText,
                            {
                              color: isInc
                                ? colors.emerald
                                : isExc
                                ? colors.accent
                                : colors.textSecondary,
                            },
                          ]}
                        >
                          {isInc ? `+ ${tagName}` : isExc ? `- ${tagName}` : tagName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Apply Footer Bar */}
      <View style={[styles.applyFooter, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {onRandomManga && (
          <Pressable
            onPress={() => {
              onClose();
              onRandomManga();
            }}
            style={[styles.luckyBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          >
            <Ionicons name="dice-outline" size={16} color={colors.text} />
            <Text style={[styles.luckyBtnText, { color: colors.text }]}>I'm Feeling Lucky</Text>
          </Pressable>
        )}
        <Pressable onPress={handleApply} style={[styles.applyBtn, { backgroundColor: colors.accent }]}>
          <Ionicons name="search" size={18} color="#FFFFFF" />
          <Text style={styles.applyBtnText}>Search</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType={isWeb ? 'fade' : 'slide'}
      transparent={isWeb}
      onRequestClose={onClose}
    >
      {isWeb ? (
        <View style={styles.webModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          {modalBody}
        </View>
      ) : (
        <SafeAreaView style={[styles.mobileContainer, { backgroundColor: colors.background }]}>
          {modalBody}
        </SafeAreaView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  webModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  mobileContainer: {
    flex: 1,
  },
  modalCard: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 760 : undefined,
    maxHeight: Platform.OS === 'web' ? ('88vh' as any) : '100%',
    flex: Platform.OS === 'web' ? undefined : 1,
    borderRadius: Platform.OS === 'web' ? Radius.lg : 0,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  resetBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.xs,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.body,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  tagHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  tagHelpText: {
    fontSize: Typography.sizes.caption,
  },
  tagGroupBlock: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: 4,
  },
  groupHeaderText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupHeaderLine: {
    flex: 1,
    height: 1,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: Typography.weights.medium,
  },
  applyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  luckyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 6,
  },
  luckyBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: Radius.md,
    gap: 6,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
});
