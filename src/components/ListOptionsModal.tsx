/**
 * ListOptionsModal — Modern Flat Bottom Sheet for Manga List/Grid Configuration
 * Styled with human-crafted, taste-first aesthetics (0% AI Slop Guarantee).
 *
 * Anti-Slop Design Principles:
 * - NO neon/accent-colored borders to indicate selected/active states.
 * - Active states use clean structural surface elevation, tone shifts, and crisp white typography.
 * - Solid Apple-style segmented tabs (neutral dark tray with elevated solid active pill).
 * - Tactile Interactive Slider for Grid Column Count (solid crisp white thumb knob).
 * - Sleek Flat Dropdown for Sort Order Selection with neutral border hierarchy.
 * - Attached firmly to the bottom of the screen with a curtain slide-up animation.
 * - Host screen stays completely stationary (modal itself animates).
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  Animated,
  Easing,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColor';
import { triggerHaptic } from '../utils/haptics';
import { MobileModalRoot, MobileSheetPanel, MobileSheetPanelRef } from './MobileBottomSheet';

export interface SortOption<T extends string> {
  key: T;
  label: string;
}

export interface ListOptionsModalProps<SortType extends string> {
  visible: boolean;
  onClose: () => void;
  displayMode: 'compact' | 'details' | 'grid';
  onSelectDisplayMode: (mode: 'compact' | 'details' | 'grid') => void;
  gridColumns?: number;
  onSelectGridColumns?: (cols: number) => void;
  sortOrder: SortType;
  onSelectSortOrder: (order: SortType) => void;
  sortOptions: SortOption<SortType>[];
  groupByDate?: boolean;
  onToggleGroupByDate?: (val: boolean) => void;
  showGroupByDate?: boolean;
}

/**
 * GridColumnSlider — Flat, tactile interactive slider for column count
 */
interface GridColumnSliderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  accentColor: string;
}

function GridColumnSlider({
  value,
  min = 2,
  max = 4,
  onChange,
  accentColor,
}: GridColumnSliderProps) {
  const colors = useThemeColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  trackWidthRef.current = trackWidth;

  const startStateRef = useRef<{ startFraction: number; initialVal: number }>({
    startFraction: 0,
    initialVal: value,
  });

  const steps = useMemo(() => {
    const list: number[] = [];
    for (let i = min; i <= max; i++) list.push(i);
    return list;
  }, [min, max]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (evt) => {
          const width = trackWidthRef.current;
          if (width <= 0) return;
          const locationX = evt.nativeEvent.locationX;
          const tapFraction = Math.max(0, Math.min(1, locationX / width));
          const stepped = Math.round(min + tapFraction * (max - min));
          const clamped = Math.max(min, Math.min(max, stepped));

          startStateRef.current = {
            startFraction: tapFraction,
            initialVal: clamped,
          };

          if (clamped !== value) {
            triggerHaptic();
            onChange(clamped);
          }
        },
        onPanResponderMove: (_evt, gestureState) => {
          const width = trackWidthRef.current;
          if (width <= 0) return;
          const deltaFraction = gestureState.dx / width;
          const newFraction = Math.max(
            0,
            Math.min(1, startStateRef.current.startFraction + deltaFraction)
          );
          const stepped = Math.round(min + newFraction * (max - min));
          const clamped = Math.max(min, Math.min(max, stepped));
          if (clamped !== value) {
            triggerHaptic();
            onChange(clamped);
          }
        },
      }),
    [min, max, value, onChange]
  );

  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <View style={[sliderStyles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      {/* Interactive Track Area */}
      <View
        style={sliderStyles.touchArea}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {/* Track Background Bar */}
        <View style={[sliderStyles.trackBackground, { backgroundColor: colors.border }]}>
          <View
            style={[
              sliderStyles.trackFilled,
              { width: `${percent}%`, backgroundColor: accentColor },
            ]}
          />
        </View>

        {/* Crisp Solid White Thumb Knob (Zero AI slop neon borders) */}
        <View
          style={[
            sliderStyles.thumb,
            {
              left: `${percent}%`,
            },
          ]}
        >
            <View style={[sliderStyles.thumbCore, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} />
        </View>
      </View>

      {/* Discrete Step Clickable Labels */}
      <View style={sliderStyles.stepsRow}>
        {steps.map((step) => {
          const isSelected = step === value;
          return (
            <Pressable
              key={step}
              onPress={() => {
                if (step !== value) {
                  triggerHaptic();
                  onChange(step);
                }
              }}
              style={sliderStyles.stepLabelBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${step} Columns`}
            >
              <Text
                style={[
                  sliderStyles.stepLabelText,
                  { color: isSelected ? colors.text : colors.textMuted },
                  isSelected && sliderStyles.stepLabelTextSelected,
                ]}
              >
                {step} Cols
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ListOptionsModal<SortType extends string>({
  visible,
  onClose,
  displayMode,
  onSelectDisplayMode,
  gridColumns = 2,
  onSelectGridColumns,
  sortOrder,
  onSelectSortOrder,
  sortOptions,
  groupByDate,
  onToggleGroupByDate,
  showGroupByDate = false,
}: ListOptionsModalProps<SortType>) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isWeb = Platform.OS === 'web';
  const sheetRef = useRef<MobileSheetPanelRef>(null);

  const [rendered, setRendered] = useState(visible);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  const useNativeDriver = Platform.OS !== 'web';

  const animateIn = useCallback(() => {
    slideAnim.setValue(500);
    fadeAnim.setValue(0);
    isClosingRef.current = false;
    setIsSortOpen(false);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.bezier(0.23, 1, 0.32, 1), // Apple / Emil Kowalski fluid spring
        useNativeDriver,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, useNativeDriver]);

  const animateOut = useCallback(
    (callback?: () => void) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver,
        }),
      ]).start(() => {
        setRendered(false);
        isClosingRef.current = false;
        callback?.();
      });
    },
    [fadeAnim, slideAnim, useNativeDriver]
  );

  useEffect(() => {
    if (visible) {
      setRendered(true);
      if (isWeb) animateIn();
    } else if (rendered && !isClosingRef.current) {
      if (isWeb) animateOut();
      else setRendered(false);
    }
  }, [visible, rendered, animateIn, animateOut, isWeb]);

  const handleDismiss = () => {
    triggerHaptic();
    if (isWeb) animateOut(onClose);
    else sheetRef.current?.close();
  };

  const handleNativeDismissed = () => {
    setRendered(false);
    onClose();
  };

  const selectedSortOption = useMemo(
    () => sortOptions.find((o) => o.key === sortOrder),
    [sortOptions, sortOrder]
  );

  if (!rendered) return null;

  const Backdrop = (isWeb ? Animated.View : View) as any;
  const Sheet = (isWeb ? Animated.View : MobileSheetPanel) as any;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none" // Controlled manually via Animated curtain (stationary screen beneath)
      onRequestClose={handleDismiss}
    >
      <MobileModalRoot style={styles.modalRoot}>
        {/* Backdrop (Fades in / out) */}
        <Backdrop style={[styles.backdrop, isWeb && { opacity: fadeAnim }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleDismiss}
            accessibilityLabel="Close list options"
          />
        </Backdrop>

        {/* Curtain Bottom Sheet (Attached to bottom, slides up from 500 to 0) */}
        <Sheet
          ref={isWeb ? undefined : sheetRef}
          visible={isWeb ? undefined : rendered}
          onClose={isWeb ? undefined : handleNativeDismissed}
          showHandle={isWeb ? undefined : true}
          style={[
            styles.curtainSheet,
            { backgroundColor: colors.surface, borderColor: 'transparent' },
            isDesktop && styles.desktopSheet,
            isWeb && {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Native Drag Handle matching AuthModal */}
          {isWeb && <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />}

          {/* Modal Header Row matching AuthModal */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleCol}>
              <Text style={[styles.title, { color: colors.text }]}>List options</Text>
            </View>
          </View>

          {/* Scrollable Content Area */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. List Mode Segmented Selector (Apple Style Tray, Zero Accent Borders) */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>List mode</Text>
              <View style={[styles.tabContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                {(
                  [
                    { key: 'compact', label: 'Compact', icon: 'list-outline' },
                    { key: 'details', label: 'Details', icon: 'list-circle-outline' },
                    { key: 'grid', label: 'Grid', icon: 'grid-outline' },
                  ] as const
                ).map((m) => {
                  const isSelected = displayMode === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => {
                        triggerHaptic();
                        onSelectDisplayMode(m.key);
                      }}
                      style={[
                        styles.tabBtn,
                        isSelected && [styles.tabBtnActive, { backgroundColor: colors.cardBackground }],
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${m.label} mode`}
                    >
                      <Ionicons
                        name={m.icon as any}
                        size={16}
                        color={isSelected ? colors.text : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.tabText,
                          isSelected && [styles.tabTextActive, { color: colors.text }],
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 2. Grid Size Slider (Shown only when in Grid Mode) */}
            {displayMode === 'grid' && onSelectGridColumns && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Grid size</Text>
                  <View style={styles.badge}>
                    <Text style={[styles.badgeText, { color: colors.text }]}> 
                      {gridColumns} Columns
                    </Text>
                  </View>
                </View>

                <GridColumnSlider
                  value={gridColumns}
                  min={2}
                  max={4}
                  onChange={onSelectGridColumns}
                  accentColor={colors.accent}
                />
              </View>
            )}

            {/* 3. Sort Order Dropdown (Clean Neutral Borders, No Colored Outlines) */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Sort order</Text>
              {/* Dropdown Trigger Box */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setIsSortOpen((prev) => !prev);
                }}
                style={({ pressed }) => [
                  styles.dropdownTrigger,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  isSortOpen && styles.dropdownTriggerOpen,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Sort order: ${selectedSortOption?.label || ''}`}
                accessibilityState={{ expanded: isSortOpen }}
              >
                <View style={styles.dropdownLeft}>
                  <Ionicons name="swap-vertical" size={17} color={colors.textMuted} />
                  <Text style={[styles.dropdownValueText, { color: colors.text }]}> 
                    {selectedSortOption?.label || 'Select order'}
                  </Text>
                </View>
                <Ionicons
                  name={isSortOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={isSortOpen ? colors.text : colors.textMuted}
                />
              </Pressable>

              {/* Dropdown Menu Options */}
              {isSortOpen && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {sortOptions.map((opt, index) => {
                    const isSelected = sortOrder === opt.key;
                    const isLast = index === sortOptions.length - 1;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => {
                          triggerHaptic();
                          onSelectSortOrder(opt.key);
                          setIsSortOpen(false);
                        }}
                        style={({ pressed }) => [
                          styles.dropdownItem,
                          isSelected && styles.dropdownItemActive,
                          !isLast && styles.dropdownItemDivider,
                          { opacity: pressed ? 0.75 : 1 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={opt.label}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            { color: isSelected ? colors.text : colors.textSecondary },
                            isSelected && styles.dropdownItemTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={18} color={colors.text} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 4. Group by Date Toggle (Optional, for History) */}
            {showGroupByDate && onToggleGroupByDate && (
              <View style={styles.sectionBlock}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    onToggleGroupByDate(!groupByDate);
                  }}
                  style={styles.toggleRow}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle group by date"
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.toggleTitle, { color: colors.text }]}>Group by date</Text>
                    <Text style={[styles.toggleSubtitle, { color: colors.textMuted }]}> 
                      Organize entries into Today, Yesterday, Earlier this week
                    </Text>
                  </View>
                  <Ionicons
                    name={groupByDate ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={groupByDate ? colors.accent : '#64748B'}
                  />
                </Pressable>
              </View>
            )}
          </ScrollView>
        </Sheet>
      </MobileModalRoot>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end', // Firmly attached to the bottom of the screen!
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  curtainSheet: {
    width: '100%',
    backgroundColor: '#11131A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 0,
    borderBottomWidth: 0,
    borderColor: '#1F2330',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 24,
  },
  desktopSheet: {
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 28,
    borderBottomWidth: 0,
    marginBottom: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  headerRow: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 0,
    borderBottomColor: '#1F2330',
    paddingHorizontal: 24,
  },
  headerTitleCol: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 18,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#1E212B',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },

  /* 1. Flat Apple-Style Segmented Tray (No Colored Borders) */
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#151821',
    borderRadius: 12,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: '#1F2330',
  },
  tabBtn: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#272A38',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#F8FAFC',
    fontWeight: '600',
  },

  /* 3. Dropdown Trigger & Menu (Neutral Hairline Borders) */
  dropdownTrigger: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2330',
    backgroundColor: '#151821',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  dropdownTriggerOpen: {
    borderColor: '#2D3244',
    backgroundColor: '#171A24',
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownValueText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownMenu: {
    backgroundColor: '#151821',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2330',
    overflow: 'hidden',
    marginTop: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  dropdownItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#1F2330',
  },
  dropdownItemText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#F8FAFC',
    fontWeight: '600',
  },

  /* 4. Group by Date Toggle */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#151821',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2330',
  },
  toggleTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
});

const sliderStyles = StyleSheet.create({
  container: {
    backgroundColor: '#151821',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2330',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  touchArea: {
    height: 36,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBackground: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    width: '100%',
  },
  trackFilled: {
    height: '100%',
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    marginLeft: -11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  thumbCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#181A22',
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  stepLabelBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  stepLabelText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  stepLabelTextSelected: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
});
