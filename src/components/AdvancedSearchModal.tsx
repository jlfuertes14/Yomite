/**
 * AdvancedSearchModal — Full MangaDex Filter & Advanced Search Modal
 * Complete MangaDex Sort Options (13 exact options), Grouped Tags,
 * Content Rating, Demographics, Status, and "I'm Feeling Lucky" Random button.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
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
  { key: 'erotica', label: 'Erótica' },
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
  const colors = Colors.dark;

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

  const toggleTag = (tagId: string) => {
    if (!includedTags.includes(tagId) && !excludedTags.includes(tagId)) {
      setIncludedTags([...includedTags, tagId]);
    } else if (includedTags.includes(tagId)) {
      setIncludedTags(includedTags.filter((t) => t !== tagId));
      setExcludedTags([...excludedTags, tagId]);
    } else {
      setExcludedTags(excludedTags.filter((t) => t !== tagId));
    }
  };

  const toggleRating = (rating: 'safe' | 'suggestive' | 'erotica' | 'pornographic') => {
    if (selectedRatings.includes(rating)) {
      setSelectedRatings(selectedRatings.filter((r) => r !== rating));
    } else {
      setSelectedRatings([...selectedRatings, rating]);
    }
  };

  const toggleStatus = (status: 'ongoing' | 'completed' | 'cancelled' | 'hiatus') => {
    if (selectedStatus.includes(status)) {
      setSelectedStatus(selectedStatus.filter((s) => s !== status));
    } else {
      setSelectedStatus([...selectedStatus, status]);
    }
  };

  const toggleDemographic = (demo: 'shounen' | 'shoujo' | 'josei' | 'seinen') => {
    if (selectedDemographic.includes(demo)) {
      setSelectedDemographic(selectedDemographic.filter((d) => d !== demo));
    } else {
      setSelectedDemographic([...selectedDemographic, demo]);
    }
  };

  const handleReset = () => {
    setTitle('');
    setIncludedTags([]);
    setExcludedTags([]);
    setSelectedRatings(['safe', 'suggestive']);
    setSelectedStatus([]);
    setSelectedDemographic([]);
    setActiveSortId('most_follows');
  };

  const handleApply = () => {
    const selectedSortOpt = MANGADEX_SORT_OPTIONS.find((s) => s.id === activeSortId) ?? MANGADEX_SORT_OPTIONS[7];

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Modal Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Advanced Search
          </Text>
          <View style={styles.headerRight}>
            <Pressable onPress={handleReset} style={styles.resetBtn}>
              <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>Reset Filters</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title Input */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Title / Keywords</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            placeholder="Search title..."
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
                      backgroundColor: active ? colors.text : colors.surface,
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
                  {/* Group Section Header with Horizontal Line */}
                  <View style={styles.groupHeaderRow}>
                    <Text style={[styles.groupHeaderText, { color: colors.text }]}>
                      {group.label}
                    </Text>
                    <View style={[styles.groupHeaderLine, { backgroundColor: colors.border }]} />
                  </View>

                  {/* Group Tag Chips */}
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
                                : colors.surface,
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

          <View style={{ height: 100 }} />
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
            <Ionicons name="search" size={18} color="#FFF" />
            <Text style={styles.applyBtnText}>Search</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  sectionLabel: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.xs,
  },
  input: {
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.body,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },
  tagHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  tagHelpText: {
    fontSize: Typography.sizes.caption,
  },
  tagGroupBlock: {
    marginTop: Spacing.sm,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  groupHeaderText: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  groupHeaderLine: {
    flex: 1,
    height: 1,
  },
  tagChip: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: Typography.sizes.caption + 1,
    fontWeight: Typography.weights.medium,
  },
  applyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  luckyBtn: {
    height: 46,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  luckyBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  applyBtn: {
    flex: 1,
    height: 46,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
});
