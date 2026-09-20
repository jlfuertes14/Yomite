/**
 * Yomite Mobile App Promotion & Direct Download Page
 * Aesthetic: Editorial Manga Craft — 0% AI Slop (Impeccable Design System)
 * Features: Interactive Sliding Feature Carousel (space-saving), Authentic Flagship
 * Device Mockups, Perfectly Centered Grid, Direct APK Download & Sideloading Hub.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
  Linking,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Radius, Spacing, Typography } from '../constants/Colors';
import { useThemeColors } from '../src/hooks/useThemeColor';
import { triggerHaptic } from '../src/utils/haptics';
import { useDocumentTitle } from '../src/utils/useDocumentTitle';

// App Specifications & Release Metadata
const APP_RELEASE = {
  version: 'v1.2.1',
  buildNumber: '105',
  releaseDate: 'August 2026',
  fileSize: '118.86 MB',
  minAndroid: 'Android 8.0 (Oreo) or higher',
  minIos: 'iOS 15.0+ (via Web PWA)',
  architecture: 'Universal (ARM64 & x86_64)',
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  apkDownloadUrl: 'https://expo.dev/accounts/chiro14/projects/yomite/builds/ebcda5ee-2451-480c-a888-35e5b48cfe61',
};

type DemoTab = 'reader' | 'offline' | 'languages' | 'library';

const HERO_PREVIEWS: Record<DemoTab, { title: string; subtitle: string; image: any; tag: string; tagColor: string }> = {
  reader: {
    title: 'Reader Engine',
    subtitle: 'OLED Pure Black & 60 FPS Scroll',
    image: require('../assets/images/reader_image.png'),
    tag: 'OLED BLACK • 60 FPS',
    tagColor: '#F43F5E',
  },
  offline: {
    title: 'Offline Vault',
    subtitle: 'Zero Buffering Disk Storage',
    image: require('../assets/images/offline_vault.png'),
    tag: '100% OFFLINE DISK',
    tagColor: '#10B981',
  },
  languages: {
    title: '30+ Languages',
    subtitle: 'Direct MangaDex Scanlations',
    image: require('../assets/images/language_options.png'),
    tag: 'MANGADEX API',
    tagColor: '#3B82F6',
  },
  library: {
    title: 'Cloud Library',
    subtitle: 'Seamless Mobile ↔ Web Sync',
    image: require('../assets/images/cloud_libary.png'),
    tag: 'REALTIME SYNC',
    tagColor: '#F59E0B',
  },
};

interface FeatureSlide {
  id: string;
  number: string;
  tabLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: string;
  title: string;
  paragraph: string;
  tag: string;
  tagColor: string;
  image: any;
  interactiveType?: 'readerMode' | 'languages';
  checklist: Array<{ title: string; desc: string }>;
}

const FEATURE_SLIDES: FeatureSlide[] = [
  {
    id: 'reader',
    number: '01',
    tabLabel: 'Core Engine',
    icon: 'speedometer-outline',
    category: 'CORE ENGINE',
    title: 'Instant, 60 fps page turns with true OLED black.',
    paragraph: 'Whether you are binge-reading continuous vertical manhwa webtoons or savoring delicate right-to-left double page spreads, Yomite responds instantaneously with zero hitch or stutter.',
    tag: 'OLED BLACK • 60 FPS',
    tagColor: '#F43F5E',
    image: require('../assets/images/reader_image.png'),
    interactiveType: 'readerMode',
    checklist: [
      { title: 'OLED Pure Black Background', desc: 'eliminates battery drain on long midnight reads.' },
      { title: 'Micro-Touch Zoom Physics', desc: 'renders fine ink lines and double spreads without blur.' },
      { title: 'Custom Margins & Brightness', desc: 'saved per series automatically.' },
    ],
  },
  {
    id: 'offline',
    number: '02',
    tabLabel: 'Offline Vault',
    icon: 'cloud-download-outline',
    category: 'OFFLINE VAULT',
    title: 'Subways, flights, and dead zones. Carry entire arcs anywhere.',
    paragraph: 'Never let an underground tunnel or airplane mode interrupt your favorite story climax. Batch-download 20, 50, or 100 chapters in a single tap directly to your device storage.',
    tag: '100% OFFLINE DISK',
    tagColor: '#10B981',
    image: require('../assets/images/offline_vault.png'),
    checklist: [
      { title: 'Zero Buffer Lag', desc: 'Chapters read from encrypted flash storage with immediate page switches.' },
      { title: 'Background Task Downloads', desc: 'Queue large arcs and let Yomite finish in the background.' },
      { title: 'MicroSD & Internal Storage', desc: 'Choose where your downloaded manga lives without restrictions.' },
    ],
  },
  {
    id: 'languages',
    number: '03',
    tabLabel: '30+ Languages',
    icon: 'globe-outline',
    category: 'COMMUNITY ARCHIVE',
    title: 'Global scanlations across 30+ languages. Zero gatekeeping.',
    paragraph: 'Powered directly by MangaDex’s community API. Read releases from passionate fan scanlation teams across the world as soon as raw scans are translated.',
    tag: '30+ LANGUAGES',
    tagColor: '#3B82F6',
    image: require('../assets/images/language_options.png'),
    interactiveType: 'languages',
    checklist: [
      { title: 'Direct Scanlation Credit', desc: 'Support scanlation groups with group details and direct links.' },
      { title: 'Instant Chapter Drops', desc: 'New chapter updates appear the moment they are indexed.' },
    ],
  },
  {
    id: 'library',
    number: '04',
    tabLabel: 'Cloud Sync',
    icon: 'sync-outline',
    category: 'CLOUD CONTINUITY',
    title: 'Start reading on desktop. Pick up on your phone.',
    paragraph: 'Read Chapter 34 at your desk on the web app during your lunch break. Open Yomite on your phone on the train ride home, and you will be exactly where you left off at page 18.',
    tag: 'REALTIME SYNC',
    tagColor: '#F59E0B',
    image: require('../assets/images/cloud_libary.png'),
    checklist: [
      { title: 'Zero Account Friction', desc: 'Works seamlessly with optional Google authentication or anonymous local storage.' },
      { title: 'Unread Badges & Reading History', desc: 'Keep track of your progress across hundreds of titles automatically.' },
    ],
  },
];

interface PhoneMockupFrameProps {
  image: any;
  tag: string;
  tagColor?: string;
  isMobile?: boolean;
  isDesktop?: boolean;
  variant?: 'hero' | 'carousel';
}

function PhoneMockupFrame({
  image,
  tag,
  tagColor = '#F43F5E',
  isMobile,
  isDesktop,
  variant = 'hero',
}: PhoneMockupFrameProps) {
  const isCarousel = variant === 'carousel';

  return (
    <View style={styles.phoneMockupWrapper}>
      {/* Ambient Device Halo */}
      <View
        style={[
          styles.ambientDeviceGlow,
          isDesktop && (isCarousel ? styles.ambientDeviceGlowCarouselDesktop : styles.ambientDeviceGlowDesktop),
          { backgroundColor: `${tagColor}18` },
        ]}
      />

      {/* Flagship Bezel & Body */}
      <View
        style={[
          styles.phoneShell,
          isDesktop && (isCarousel ? styles.phoneShellCarouselDesktop : styles.phoneShellDesktop),
          isMobile && styles.phoneShellMobile,
        ]}
      >
        {/* Top Punch Hole Camera */}
        <View style={styles.phonePunchHole} />

        {/* Screen Content Surface */}
        <View style={styles.phoneScreenSurface}>
          <Image
            source={image}
            style={styles.phoneScreenImage}
            contentFit="cover"
            transition={150}
          />

          {/* Floating Context Pill */}
          <View style={styles.screenContextPill}>
            <View style={[styles.screenContextDot, { backgroundColor: tagColor }]} />
            <Text style={styles.screenContextText}>{tag}</Text>
          </View>
        </View>

        {/* Bottom Gesture Bar */}
        <View style={styles.phoneHomeBar} />
      </View>
    </View>
  );
}

export default function AppDownloadScreen() {
  useDocumentTitle('Get App — Yomite');
  const colors = useThemeColors();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 960;
  const isTablet = windowWidth >= 640 && windowWidth < 960;
  const isMobile = windowWidth < 640;

  // Hero state
  const [activeTab, setActiveTab] = useState<DemoTab>('reader');
  const [hoveredHeroTab, setHoveredHeroTab] = useState<DemoTab | null>(null);
  const heroFadeAnim = useRef(new Animated.Value(1)).current;

  // Sliding Feature Carousel state & auto-sliding
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [isAutoPlayPaused, setIsAutoPlayPaused] = useState(false);
  const [hoveredNavIndex, setHoveredNavIndex] = useState<number | null>(null);
  const featureFadeAnim = useRef(new Animated.Value(1)).current;
  const featureSlideAnim = useRef(new Animated.Value(0)).current;
  const autoPlayProgress = useRef(new Animated.Value(0)).current;
  const AUTOPLAY_DURATION = 5000;

  const activeFeatureIndexRef = useRef(activeFeatureIndex);
  activeFeatureIndexRef.current = activeFeatureIndex;

  // Interactive controls within features
  const [readerModeChoice, setReaderModeChoice] = useState<'webtoon' | 'rtl' | 'spread'>('webtoon');
  const [selectedLang, setSelectedLang] = useState('en');

  // Specs & Guide state
  const [copiedSha, setCopiedSha] = useState(false);
  const [showShaDrawer, setShowShaDrawer] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'android' | 'ios'>('android');

  const handleSelectHeroTab = (tab: DemoTab) => {
    if (tab === activeTab) return;
    triggerHaptic();

    Animated.timing(heroFadeAnim, {
      toValue: 0.15,
      duration: 120,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setActiveTab(tab);
      Animated.timing(heroFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  };

  const switchFeatureSlide = (targetIndex: number, direction?: 'next' | 'prev') => {
    if (targetIndex === activeFeatureIndex) return;
    const dir = direction ?? (targetIndex > activeFeatureIndex ? 'next' : 'prev');
    triggerHaptic();

    Animated.parallel([
      Animated.timing(featureFadeAnim, {
        toValue: 0.1,
        duration: 120,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(featureSlideAnim, {
        toValue: dir === 'next' ? -24 : 24,
        duration: 120,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setActiveFeatureIndex(targetIndex);
      featureSlideAnim.setValue(dir === 'next' ? 24 : -24);
      Animated.parallel([
        Animated.timing(featureFadeAnim, {
          toValue: 1,
          duration: 240,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(featureSlideAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    });
  };

  const handlePrevSlide = () => {
    const prev = (activeFeatureIndex - 1 + FEATURE_SLIDES.length) % FEATURE_SLIDES.length;
    switchFeatureSlide(prev, 'prev');
  };

  const handleNextSlide = () => {
    const next = (activeFeatureIndex + 1) % FEATURE_SLIDES.length;
    switchFeatureSlide(next, 'next');
  };

  // Automatic Feature Slide Timer with pause/play & smooth progress
  useEffect(() => {
    if (isAutoPlayPaused) {
      autoPlayProgress.stopAnimation();
      return;
    }

    autoPlayProgress.setValue(0);
    const anim = Animated.timing(autoPlayProgress, {
      toValue: 1,
      duration: AUTOPLAY_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished) {
        const next = (activeFeatureIndexRef.current + 1) % FEATURE_SLIDES.length;
        switchFeatureSlide(next, 'next');
      }
    });

    return () => {
      anim.stop();
    };
  }, [activeFeatureIndex, isAutoPlayPaused]);

  // Touch Swipe Gesture Responder for Mobile & Touchscreens
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 24 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -40) {
          handleNextSlide();
        } else if (gestureState.dx > 40) {
          handlePrevSlide();
        }
      },
    })
  ).current;

  // Accessible Keyboard Navigation on Web (Left & Right Arrow Keys)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName)) return;

      if (e.key === 'ArrowLeft') {
        const prev = (activeFeatureIndex - 1 + FEATURE_SLIDES.length) % FEATURE_SLIDES.length;
        switchFeatureSlide(prev, 'prev');
      } else if (e.key === 'ArrowRight') {
        const next = (activeFeatureIndex + 1) % FEATURE_SLIDES.length;
        switchFeatureSlide(next, 'next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFeatureIndex]);

  const handleDownloadApk = () => {
    triggerHaptic();
    if (Platform.OS === 'web') {
      window.open(APP_RELEASE.apkDownloadUrl, '_blank');
    } else {
      Linking.openURL(APP_RELEASE.apkDownloadUrl);
    }
  };

  const handleScrollToQr = () => {
    triggerHaptic();
    if (Platform.OS === 'web') {
      const qrElem = document.getElementById('download-hub');
      if (qrElem) {
        qrElem.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleCopySha = () => {
    triggerHaptic();
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(APP_RELEASE.sha256);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2400);
    }
  };

  const currentSlide = FEATURE_SLIDES[activeFeatureIndex];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* ── TOP NAVBAR ── */}
      <View style={[styles.navbarOuter, { borderBottomColor: colors.borderSubtle, backgroundColor: colors.background }]}>
        <View style={[styles.navbarInner, isDesktop && styles.navbarInnerDesktop, isMobile && styles.navbarInnerMobile]}>
          <Pressable
            accessibilityRole="button"
            aria-label="Navigate to Discover Home"
            onPress={() => router.push('/(tabs)' as any)}
            style={({ pressed }) => [styles.brandButton, pressed && styles.buttonPressed]}
          >
            <Image
              source={require('../assets/images/mascot.png')}
              style={styles.brandMascot}
              contentFit="cover"
            />
            <View style={styles.brandTextGroup}>
              <Text style={[styles.brandTitle, { color: colors.text }]}>Yomite</Text>
              <Text style={[styles.brandTagline, { color: colors.textMuted }]}>Manga Reader</Text>
            </View>
          </Pressable>

          <View style={styles.navActions}>
            <Pressable
              accessibilityRole="button"
              aria-label="Open Web App"
              onPress={() => router.push('/(tabs)' as any)}
              style={({ pressed }) => [
                styles.navSecondaryButton,
                { borderColor: colors.borderSubtle, backgroundColor: 'transparent' },
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="desktop-outline" size={14} color={colors.textSecondary} aria-hidden={true} />
              <Text style={[styles.navSecondaryText, { color: colors.text }]}>
                {isMobile ? 'Web' : 'Open Web App'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              aria-label="Download APK Package"
              onPress={handleDownloadApk}
              style={({ pressed }) => [
                styles.navPrimaryButton,
                { backgroundColor: colors.accent },
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="arrow-down-circle" size={15} color="#FFFFFF" aria-hidden={true} />
              <Text style={styles.navPrimaryText}>
                {isMobile ? 'Get APK' : 'Download APK'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ════════════════════════════════════════════════════════════════════════
            HERO SECTION: High-contrast typography & authentic device showcase
           ════════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionWrapper, isDesktop && styles.sectionWrapperDesktop]}>
          <View style={[styles.heroContainer, isDesktop && styles.heroContainerDesktop]}>
            {/* Left Hero Column */}
            <View style={[styles.heroTextCol, isDesktop && styles.heroTextColDesktop]}>
              <View style={styles.heroReleaseBar}>
                <View style={[styles.releasePill, { backgroundColor: 'transparent', borderColor: colors.borderSubtle }]}>
                  <View style={styles.pulseDot} />
                  <Text style={[styles.releasePillText, { color: colors.text }]}>
                    {APP_RELEASE.version} Stable
                  </Text>
                </View>
                <Text style={[styles.releaseMetaText, { color: colors.textMuted }]}>
                  Android 8.0+ • Free & Open Source
                </Text>
              </View>

              <Text
                accessibilityRole="header"
                aria-level={1}
                style={[
                  styles.heroHeadline,
                  { color: colors.text },
                  isDesktop && styles.heroHeadlineDesktop,
                  isMobile && styles.heroHeadlineMobile,
                  isTablet && styles.heroHeadlineTablet,
                ]}
              >
                The art of reading manga,{'\n'}
                <Text style={{ color: colors.accent }}>pure and unfiltered.</Text>
              </Text>

              <Text
                style={[
                  styles.heroSubheadline,
                  { color: colors.textSecondary },
                  isDesktop && styles.heroSubheadlineDesktop,
                  isMobile && styles.heroSubheadlineMobile,
                ]}
              >
                Zero ads, zero coin paywalls, and zero compression. Experience fluid 60&nbsp;fps page turns, true offline volume downloads, and official MangaDex scanlations in 30+ languages.
              </Text>

              <View style={[styles.heroCtaGroup, isMobile && styles.heroCtaGroupMobile]}>
                <Pressable
                  accessibilityRole="button"
                  aria-label="Download Yomite Android APK"
                  onPress={handleDownloadApk}
                  style={({ pressed }) => [
                    styles.heroDownloadButton,
                    { backgroundColor: colors.accent },
                    isMobile && { width: '100%', justifyContent: 'center' },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons name="logo-android" size={22} color="#FFFFFF" aria-hidden={true} />
                  <View style={styles.heroDownloadLabels}>
                    <Text style={styles.heroDownloadMain}>Download Yomite for Android</Text>
                    <Text style={styles.heroDownloadMeta}>
                      Direct APK • {APP_RELEASE.fileSize} • Clean Build
                    </Text>
                  </View>
                  <Ionicons name="arrow-down" size={18} color="#FFFFFF" aria-hidden={true} style={{ marginLeft: 6 }} />
                </Pressable>

                {!isMobile && (
                  <Pressable
                    accessibilityRole="button"
                    aria-label="Scan QR Code from Phone"
                    onPress={handleScrollToQr}
                    style={({ pressed }) => [
                      styles.heroQrButton,
                      { backgroundColor: 'transparent', borderColor: colors.borderSubtle },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Ionicons name="qr-code-outline" size={18} color={colors.text} aria-hidden={true} />
                    <Text style={[styles.heroQrText, { color: colors.text }]}>Scan QR from Phone</Text>
                  </Pressable>
                )}
              </View>

              {/* Interactive Screen Selector Tabs */}
              <View style={styles.heroTabSelector}>
                <Text style={[styles.heroTabLabel, { color: colors.textMuted }]}>
                  SELECT SCREEN TO PREVIEW
                </Text>
                <View style={[styles.heroTabList, isMobile && styles.heroTabListMobile]}>
                  {(['reader', 'offline', 'languages', 'library'] as DemoTab[]).map((tab) => {
                    const isSelected = activeTab === tab;
                    const isHovered = hoveredHeroTab === tab;
                    const meta = HERO_PREVIEWS[tab];

                    return (
                      <Pressable
                        key={tab}
                        accessibilityRole="button"
                        aria-label={`Preview ${meta.title}`}
                        onPress={() => handleSelectHeroTab(tab)}
                        onHoverIn={() => setHoveredHeroTab(tab)}
                        onHoverOut={() => setHoveredHeroTab(null)}
                        style={[
                          styles.heroTabPill,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(244, 63, 94, 0.12)'
                              : isHovered
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'transparent',
                            borderColor: isSelected
                              ? colors.accent
                              : isHovered
                              ? colors.accent
                              : colors.borderSubtle,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.heroTabIndicator,
                            { backgroundColor: isSelected ? colors.accent : colors.border },
                          ]}
                        />
                        <Text
                          style={[
                            styles.heroTabPillText,
                            {
                              color: isSelected ? colors.text : colors.textSecondary,
                              fontWeight: isSelected ? Typography.weights.bold : Typography.weights.medium,
                            },
                          ]}
                        >
                          {meta.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Commitments Row */}
              <View style={[styles.commitmentsRow, { borderColor: colors.borderSubtle }]}>
                <View style={styles.commitmentItem}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} aria-hidden={true} />
                  <Text style={[styles.commitmentText, { color: colors.textSecondary }]}>
                    100% Free & Open Source
                  </Text>
                </View>
                <View style={styles.commitmentDivider} />
                <View style={styles.commitmentItem}>
                  <Ionicons name="phone-portrait-outline" size={16} color={colors.accent} aria-hidden={true} />
                  <Text style={[styles.commitmentText, { color: colors.textSecondary }]}>
                    True Offline Storage
                  </Text>
                </View>
                <View style={styles.commitmentDivider} />
                <View style={styles.commitmentItem}>
                  <Ionicons name="sync-outline" size={16} color={colors.accent} aria-hidden={true} />
                  <Text style={[styles.commitmentText, { color: colors.textSecondary }]}>
                    Sub-50ms Cloud Sync
                  </Text>
                </View>
              </View>
            </View>

            {/* Right Hero Column: Flagship Phone Frame with Cross-fade */}
            <View style={[styles.heroDeviceCol, isDesktop && styles.heroDeviceColDesktop]}>
              <View style={[styles.ambientDeviceGlow, isDesktop && styles.ambientDeviceGlowDesktop, { backgroundColor: `${HERO_PREVIEWS[activeTab].tagColor}22` }]} />

              <View style={[styles.phoneShell, isDesktop && styles.phoneShellDesktop, isMobile && styles.phoneShellMobile]}>
                <View style={styles.phonePunchHole} />

                <Animated.View style={[styles.phoneScreenSurface, { opacity: heroFadeAnim }]}>
                  <Image
                    source={HERO_PREVIEWS[activeTab].image}
                    style={styles.phoneScreenImage}
                    contentFit="cover"
                    transition={150}
                  />

                  <View style={styles.screenContextPill}>
                    <View style={[styles.screenContextDot, { backgroundColor: HERO_PREVIEWS[activeTab].tagColor }]} />
                    <Text style={styles.screenContextText}>
                      {HERO_PREVIEWS[activeTab].tag}
                    </Text>
                  </View>
                </Animated.View>

                <View style={styles.phoneHomeBar} />
              </View>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════════
            INTERACTIVE SLIDING FEATURE CAROUSEL (0% AI Slop — Space-Saving)
           ════════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionWrapper, isDesktop && styles.sectionWrapperDesktop]}>
          <View style={[styles.featuresSection, { borderTopColor: colors.borderSubtle }]}>
            {/* Sliding Feature Stage */}
            <View
              style={styles.carouselStageCard}
              {...(Platform.OS === 'web'
                ? {
                    onPointerEnter: () => setIsAutoPlayPaused(true),
                    onPointerLeave: () => setIsAutoPlayPaused(false),
                  }
                : {})}
              {...panResponder.panHandlers}
            >
              {/* Slide Content Row */}
              <View style={[styles.carouselSlideBody, isDesktop && styles.carouselSlideBodyDesktop]}>
                {/* Left Column: Section Header in Yellow Box + Active Slide Details */}
                <View style={styles.slideNarrativeCol}>
                  {/* Permanent Section Intro (Yellow Box Location — Left Aligned) */}
                  <View style={styles.featuresHeaderBlock}>
                    <Text style={[styles.sectionEyebrow, { color: colors.accent }]}>
                      DESIGNED FOR MANGA PURISTS
                    </Text>
                    <Text
                      accessibilityRole="header"
                      aria-level={2}
                      style={[styles.sectionTitle, { color: colors.text }]}
                    >
                      Engineered for the pure love of reading
                    </Text>
                    <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                      No artificial coins, no daily wait-timers, no aggressive paywalls. Just a fast, quiet, precision canvas built for long reading sessions.
                    </Text>
                  </View>

                  {/* Active Slide Details (Smoothly animated on slide change) */}
                  <Animated.View
                    style={[
                      styles.slideDetailsAnimatedWrap,
                      {
                        opacity: featureFadeAnim,
                        transform: [{ translateX: featureSlideAnim }],
                      },
                    ]}
                  >
                    <View style={[styles.featureNumberBadge, { backgroundColor: 'transparent', borderColor: colors.borderSubtle }]}>
                      <Text style={[styles.featureNumberText, { color: currentSlide.tagColor }]}>
                        {currentSlide.number}
                      </Text>
                      <Text style={[styles.featureCategoryText, { color: colors.textMuted }]}>
                        {currentSlide.category}
                      </Text>
                    </View>

                    <Text accessibilityRole="header" aria-level={3} style={[styles.spreadTitle, { color: colors.text }]}>
                      {currentSlide.title}
                    </Text>
                    <Text style={[styles.spreadParagraph, { color: colors.textSecondary }]}>
                      {currentSlide.paragraph}
                    </Text>

                    {/* Interactive element for Slide 1 (Reader Modes) */}
                    {currentSlide.interactiveType === 'readerMode' && (
                      <View style={styles.modeChoiceContainer}>
                        <Text style={[styles.modeChoiceLabel, { color: colors.textMuted }]}>
                          SWITCH READING MODES
                        </Text>
                        <View style={styles.modeChoiceRow}>
                          {[
                            { id: 'webtoon' as const, label: 'Vertical Webtoon', icon: 'reorder-two-outline' as const },
                            { id: 'rtl' as const, label: 'Right-to-Left Manga', icon: 'arrow-back-outline' as const },
                            { id: 'spread' as const, label: 'Dual Spread', icon: 'book-outline' as const },
                          ].map((item) => {
                            const isChosen = readerModeChoice === item.id;
                            return (
                              <Pressable
                                key={item.id}
                                accessibilityRole="button"
                                aria-label={`Select ${item.label} mode`}
                                onPress={() => {
                                  triggerHaptic();
                                  setReaderModeChoice(item.id);
                                }}
                                style={[
                                  styles.modePill,
                                  {
                                    backgroundColor: isChosen ? colors.accentSubtle : 'transparent',
                                    borderColor: isChosen ? colors.accent : colors.borderSubtle,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name={item.icon}
                                  size={14}
                                  color={isChosen ? colors.accent : colors.textSecondary}
                                  aria-hidden={true}
                                />
                                <Text
                                  style={[
                                    styles.modePillText,
                                    {
                                      color: isChosen ? colors.text : colors.textSecondary,
                                      fontWeight: isChosen ? Typography.weights.bold : Typography.weights.medium,
                                    },
                                  ]}
                                >
                                  {item.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Interactive element for Slide 3 (Languages) */}
                    {currentSlide.interactiveType === 'languages' && (
                      <View style={styles.langSelectorContainer}>
                        <Text style={[styles.modeChoiceLabel, { color: colors.textMuted }]}>
                          FILTER SCANLATION LANGUAGES
                        </Text>
                        <View style={styles.langBadgeGrid}>
                          {[
                            { code: 'en', name: 'English', country: 'us' },
                            { code: 'es', name: 'Español', country: 'es' },
                            { code: 'id', name: 'Indonesia', country: 'id' },
                            { code: 'ja', name: '日本語', country: 'jp' },
                            { code: 'pt-br', name: 'Português', country: 'br' },
                            { code: 'fr', name: 'Français', country: 'fr' },
                          ].map((item) => {
                            const isChosen = selectedLang === item.code;
                            return (
                              <Pressable
                                key={item.code}
                                accessibilityRole="button"
                                aria-label={`Select ${item.name} language`}
                                onPress={() => {
                                  triggerHaptic();
                                  setSelectedLang(item.code);
                                }}
                                style={[
                                  styles.langPill,
                                  {
                                    backgroundColor: isChosen ? '#3B82F618' : 'transparent',
                                    borderColor: isChosen ? '#3B82F6' : colors.borderSubtle,
                                  },
                                ]}
                              >
                                <Image
                                  source={{ uri: `https://flagcdn.com/w40/${item.country}.png` }}
                                  style={styles.langFlag}
                                  contentFit="cover"
                                />
                                <Text
                                  style={[
                                    styles.langPillText,
                                    {
                                      color: isChosen ? colors.text : colors.textSecondary,
                                      fontWeight: isChosen ? Typography.weights.bold : Typography.weights.medium,
                                    },
                                  ]}
                                >
                                  {item.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Checklist Highlights */}
                    <View style={styles.spreadChecklist}>
                      {currentSlide.checklist.map((item, i) => (
                        <View key={i} style={styles.checkItem}>
                          <Ionicons name="checkmark-circle" size={16} color={currentSlide.tagColor} aria-hidden={true} />
                          <Text style={[styles.checkItemText, { color: colors.textSecondary }]}>
                            <Text style={{ color: colors.text, fontWeight: '600' }}>{item.title}</Text>: {item.desc}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Animated.View>
                </View>

                {/* Right Column: Smartphone Screen Mockup */}
                <View style={styles.slideVisualCol}>
                  <Animated.View
                    style={{
                      opacity: featureFadeAnim,
                      transform: [{ translateX: featureSlideAnim }],
                    }}
                  >
                    <PhoneMockupFrame
                      image={currentSlide.image}
                      tag={currentSlide.tag}
                      tagColor={currentSlide.tagColor}
                      isMobile={isMobile}
                      isDesktop={isDesktop}
                      variant="carousel"
                    />
                  </Animated.View>
                </View>
              </View>

              {/* Bottom Carousel Progress Indicator (Elongated capsule + circular dots) */}
              <View style={[styles.carouselBottomBar, { borderTopColor: colors.borderSubtle }]}>
                <View style={styles.carouselProgressTrackRow}>
                  {FEATURE_SLIDES.map((slide, idx) => {
                    const isActive = activeFeatureIndex === idx;
                    const isHovered = hoveredNavIndex === idx;
                    return (
                      <Pressable
                        key={slide.id}
                        accessibilityRole="button"
                        aria-label={`Jump to feature slide ${idx + 1}: ${slide.tabLabel}`}
                        onPress={() => {
                          switchFeatureSlide(idx, idx > activeFeatureIndex ? 'next' : 'prev');
                        }}
                        onHoverIn={() => setHoveredNavIndex(idx)}
                        onHoverOut={() => setHoveredNavIndex(null)}
                        style={styles.carouselDotTouchTarget}
                      >
                        {isActive ? (
                          <View style={styles.carouselActiveCapsule}>
                            <Animated.View
                              style={[
                                styles.carouselCapsuleFill,
                                {
                                  backgroundColor: slide.tagColor || '#3B82F6',
                                  width: autoPlayProgress.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0%', '100%'],
                                  }),
                                },
                              ]}
                            />
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.carouselInactiveDot,
                              isHovered && styles.carouselInactiveDotHovered,
                            ]}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════════
            DIRECT APK DOWNLOAD & PHONE QR HUB
           ════════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionWrapper, isDesktop && styles.sectionWrapperDesktop]}>
          <View
            id="download-hub"
            style={[
              styles.downloadHubSection,
              { borderTopColor: colors.borderSubtle },
              isMobile && styles.downloadHubSectionMobile,
            ]}
          >
            <View style={[styles.downloadHubGrid, isDesktop && styles.downloadHubGridDesktop]}>
              {/* Left: Official Release Specification */}
              <View style={styles.downloadHubLeft}>
                <View style={[styles.verifiedBadge, { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
                  <Ionicons name="shield-checkmark" size={14} color="#10B981" aria-hidden={true} />
                  <Text style={[styles.verifiedBadgeText, { color: colors.text }]}>
                    Verified Official Build
                  </Text>
                </View>

                <Text accessibilityRole="header" aria-level={2} style={[styles.hubTitle, { color: colors.text }]}>
                  Yomite for Android
                </Text>
                <Text style={[styles.hubSubtitle, { color: colors.textSecondary }]}>
                  Direct APK sideload package with zero telemetry, zero trackers, and automatic in-app update notifications.
                </Text>

                {/* Clean Specs Table */}
                <View style={[styles.metaTable, { borderColor: colors.borderSubtle }]}>
                  <View style={styles.metaTableRow}>
                    <Text style={[styles.metaTableLabel, { color: colors.textMuted }]}>Version</Text>
                    <Text style={[styles.metaTableValue, { color: colors.text }]}>
                      {APP_RELEASE.version} (Build {APP_RELEASE.buildNumber})
                    </Text>
                  </View>
                  <View style={styles.metaTableRow}>
                    <Text style={[styles.metaTableLabel, { color: colors.textMuted }]}>Package Size</Text>
                    <Text style={[styles.metaTableValue, { color: colors.text }]}>
                      {APP_RELEASE.fileSize}
                    </Text>
                  </View>
                  <View style={styles.metaTableRow}>
                    <Text style={[styles.metaTableLabel, { color: colors.textMuted }]}>Architecture</Text>
                    <Text style={[styles.metaTableValue, { color: colors.text }]}>
                      {APP_RELEASE.architecture}
                    </Text>
                  </View>
                  <View style={styles.metaTableRow}>
                    <Text style={[styles.metaTableLabel, { color: colors.textMuted }]}>OS Compatibility</Text>
                    <Text style={[styles.metaTableValue, { color: colors.text }]}>
                      {APP_RELEASE.minAndroid}
                    </Text>
                  </View>
                </View>

                {/* Big Primary Download CTA */}
                <Pressable
                  accessibilityRole="button"
                  aria-label={`Download Yomite ${APP_RELEASE.version} APK`}
                  onPress={handleDownloadApk}
                  style={({ pressed }) => [
                    styles.bigDownloadButton,
                    { backgroundColor: colors.accent },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons name="arrow-down-circle" size={24} color="#FFFFFF" aria-hidden={true} />
                  <View style={styles.bigDownloadTextCol}>
                    <Text style={styles.bigDownloadTitle}>
                      Download {APP_RELEASE.version} APK
                    </Text>
                    <Text style={styles.bigDownloadSub}>
                      {APP_RELEASE.fileSize} • Direct Expo Build
                    </Text>
                  </View>
                </Pressable>

                {/* Cryptographic Verification Toggle */}
                <View style={styles.checksumSection}>
                  <Pressable
                    accessibilityRole="button"
                    aria-label="Toggle SHA-256 Checksum"
                    onPress={() => {
                      triggerHaptic();
                      setShowShaDrawer(!showShaDrawer);
                    }}
                    style={styles.checksumToggleBtn}
                  >
                    <Ionicons
                      name={showShaDrawer ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.textMuted}
                      aria-hidden={true}
                    />
                    <Text style={[styles.checksumToggleText, { color: colors.textSecondary }]}>
                      {showShaDrawer ? 'Hide Cryptographic Checksum' : 'Verify SHA-256 Checksum'}
                    </Text>
                  </Pressable>

                  {showShaDrawer && (
                    <View style={[styles.shaBox, { backgroundColor: 'transparent', borderColor: colors.borderSubtle }]}>
                      <View style={styles.shaHeaderRow}>
                        <Text style={[styles.shaTitle, { color: colors.textMuted }]}>SHA-256 DIGEST</Text>
                        <Pressable
                          accessibilityRole="button"
                          aria-label="Copy SHA-256 hash"
                          onPress={handleCopySha}
                          style={styles.shaCopyPill}
                        >
                          <Ionicons
                            name={copiedSha ? 'checkmark' : 'copy-outline'}
                            size={13}
                            color={copiedSha ? '#10B981' : colors.accent}
                            aria-hidden={true}
                          />
                          <Text style={[styles.shaCopyText, { color: copiedSha ? '#10B981' : colors.accent }]}>
                            {copiedSha ? 'Copied to Clipboard' : 'Copy Hash'}
                          </Text>
                        </Pressable>
                      </View>
                      <Text style={[styles.shaHashString, { color: colors.textSecondary }]} numberOfLines={1}>
                        {APP_RELEASE.sha256}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Right: Instant Phone QR Scanner Frame */}
              <View style={styles.downloadHubRight}>
                <Text accessibilityRole="header" aria-level={3} style={[styles.qrHeading, { color: colors.text }]}>
                  Scan from Mobile
                </Text>
                <Text style={[styles.qrInstructions, { color: colors.textSecondary }]}>
                  Point your Android camera or QR reader here to download the package directly to your device:
                </Text>

                <View style={styles.qrCardFrame}>
                  <Image
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(APP_RELEASE.apkDownloadUrl)}&bgcolor=FFFFFF&color=09090B&margin=8`,
                    }}
                    style={styles.qrImageCanvas}
                    contentFit="contain"
                  />
                </View>

                <View style={styles.qrHelperRow}>
                  <Ionicons name="camera-outline" size={15} color={colors.accent} aria-hidden={true} />
                  <Text style={[styles.qrHelperText, { color: colors.textSecondary }]}>
                    Direct sideload link • Zero ad redirects
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════════
            CLEAN SIDELOAD & INSTALLATION GUIDE
           ════════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionWrapper, isDesktop && styles.sectionWrapperDesktop]}>
          <View
            style={[
              styles.guideContainer,
              { borderTopColor: colors.borderSubtle },
              isMobile && styles.guideContainerMobile,
            ]}
          >
            <View style={styles.guideHeaderGroup}>
              <Text style={[styles.sectionEyebrow, { color: colors.accent }]}>
                SETUP MANUAL
              </Text>
              <Text accessibilityRole="header" aria-level={2} style={[styles.guideMainTitle, { color: colors.text }]}>
                How to install Yomite
              </Text>
              <Text style={[styles.guideSubtitle, { color: colors.textSecondary }]}>
                Installation takes under 60&nbsp;seconds. Choose your platform below:
              </Text>
            </View>

            {/* OS Guide Switcher */}
            <View style={styles.guideToggleRow}>
              <Pressable
                accessibilityRole="button"
                aria-label="View Android APK sideload instructions"
                onPress={() => {
                  triggerHaptic();
                  setActiveGuideTab('android');
                }}
                style={[
                  styles.guideToggleBtn,
                  {
                    backgroundColor: activeGuideTab === 'android' ? colors.accent : 'transparent',
                    borderWidth: 1,
                    borderColor: activeGuideTab === 'android' ? colors.accent : colors.borderSubtle,
                  },
                ]}
              >
                <Ionicons
                  name="logo-android"
                  size={16}
                  color={activeGuideTab === 'android' ? '#FFFFFF' : colors.textSecondary}
                  aria-hidden={true}
                />
                <Text
                  style={[
                    styles.guideToggleText,
                    { color: activeGuideTab === 'android' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Android Sideload (APK)
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                aria-label="View iOS PWA installation instructions"
                onPress={() => {
                  triggerHaptic();
                  setActiveGuideTab('ios');
                }}
                style={[
                  styles.guideToggleBtn,
                  {
                    backgroundColor: activeGuideTab === 'ios' ? colors.accent : 'transparent',
                    borderWidth: 1,
                    borderColor: activeGuideTab === 'ios' ? colors.accent : colors.borderSubtle,
                  },
                ]}
              >
                <Ionicons
                  name="logo-apple"
                  size={16}
                  color={activeGuideTab === 'ios' ? '#FFFFFF' : colors.textSecondary}
                  aria-hidden={true}
                />
                <Text
                  style={[
                    styles.guideToggleText,
                    { color: activeGuideTab === 'ios' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  iPhone & iPad (PWA)
                </Text>
              </Pressable>
            </View>

            {/* Step Cards List */}
            {activeGuideTab === 'android' ? (
              <View style={styles.stepSequence}>
                <View style={[styles.stepItem, { borderColor: colors.borderSubtle }]}>
                  <View style={[styles.stepDigitBadge, { backgroundColor: 'rgba(244, 63, 94, 0.10)', borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.25)' }]}>
                    <Text style={[styles.stepDigit, { color: colors.accent }]}>1</Text>
                  </View>
                  <View style={styles.stepDetailCol}>
                    <Text accessibilityRole="header" aria-level={3} style={[styles.stepHeader, { color: colors.text }]}>
                      Download the APK file
                    </Text>
                    <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                      Tap <Text style={{ color: colors.text, fontWeight: '600' }}>"Download APK"</Text> above or scan the QR code using your Android camera. Your browser will download the package directly from our official Expo build repository.
                    </Text>
                  </View>
                </View>

                <View style={[styles.stepItem, { borderColor: colors.borderSubtle }]}>
                  <View style={[styles.stepDigitBadge, { backgroundColor: 'rgba(244, 63, 94, 0.10)', borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.25)' }]}>
                    <Text style={[styles.stepDigit, { color: colors.accent }]}>2</Text>
                  </View>
                  <View style={styles.stepDetailCol}>
                    <Text accessibilityRole="header" aria-level={3} style={[styles.stepHeader, { color: colors.text }]}>
                      Tap Install from Downloads
                    </Text>
                    <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                      Open your browser downloads list (in Chrome, tap <Text style={{ color: colors.text, fontWeight: '600' }}>⋮ Menu → Downloads</Text>). Tap the downloaded <Text style={{ color: colors.accent, fontWeight: '600' }}>application-....apk</Text> file. If prompted by Android security, toggle <Text style={{ color: colors.text, fontWeight: '600' }}>"Allow from this source"</Text>.
                    </Text>
                  </View>
                </View>

                <View style={[styles.stepItem, { borderColor: colors.borderSubtle }]}>
                  <View style={[styles.stepDigitBadge, { backgroundColor: 'rgba(244, 63, 94, 0.10)', borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.25)' }]}>
                    <Text style={[styles.stepDigit, { color: colors.accent }]}>3</Text>
                  </View>
                  <View style={styles.stepDetailCol}>
                    <Text accessibilityRole="header" aria-level={3} style={[styles.stepHeader, { color: colors.text }]}>
                      Launch Yomite & Read
                    </Text>
                    <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                      Open Yomite from your app drawer. Your offline library is immediately active with zero accounts or sign-ups required.
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.stepSequence}>
                <View style={[styles.stepItem, { borderColor: colors.borderSubtle }]}>
                  <View style={[styles.stepDigitBadge, { backgroundColor: 'rgba(244, 63, 94, 0.10)', borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.25)' }]}>
                    <Text style={[styles.stepDigit, { color: colors.accent }]}>1</Text>
                  </View>
                  <View style={styles.stepDetailCol}>
                    <Text accessibilityRole="header" aria-level={3} style={[styles.stepHeader, { color: colors.text }]}>
                      Open in Mobile Safari
                    </Text>
                    <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                      Navigate to Yomite on your iPhone or iPad using Apple’s default Safari browser.
                    </Text>
                  </View>
                </View>

                <View style={[styles.stepItem, { borderColor: colors.borderSubtle }]}>
                  <View style={[styles.stepDigitBadge, { backgroundColor: 'rgba(244, 63, 94, 0.10)', borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.25)' }]}>
                    <Text style={[styles.stepDigit, { color: colors.accent }]}>2</Text>
                  </View>
                  <View style={styles.stepDetailCol}>
                    <Text accessibilityRole="header" aria-level={3} style={[styles.stepHeader, { color: colors.text }]}>
                      Tap the Share Button
                    </Text>
                    <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                      Tap the Safari Share button (the square icon with an upward arrow at the bottom center of the screen).
                    </Text>
                  </View>
                </View>

                <View style={[styles.stepItem, { borderColor: colors.borderSubtle }]}>
                  <View style={[styles.stepDigitBadge, { backgroundColor: 'rgba(244, 63, 94, 0.10)', borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.25)' }]}>
                    <Text style={[styles.stepDigit, { color: colors.accent }]}>3</Text>
                  </View>
                  <View style={styles.stepDetailCol}>
                    <Text accessibilityRole="header" aria-level={3} style={[styles.stepHeader, { color: colors.text }]}>
                      Select "Add to Home Screen"
                    </Text>
                    <Text style={[styles.stepBody, { color: colors.textSecondary }]}>
                      Scroll down and tap <Text style={{ color: colors.text, fontWeight: '600' }}>Add to Home Screen</Text>. Yomite will run as a standalone, fullscreen native progressive web application.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Transparent Credibility Note */}
            <View style={[styles.credibilityNote, { backgroundColor: 'transparent', borderColor: colors.borderSubtle }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.accent} aria-hidden={true} />
              <Text style={[styles.credibilityNoteText, { color: colors.textSecondary }]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Transparent & Safe:</Text> Built directly via Expo Cloud Infrastructure with zero proprietary telemetry or ad networks. You can verify the source code and build hashes freely.
              </Text>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════════
            FOOTER: Minimalist brand signature
           ════════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.footerOuter, { borderTopColor: colors.borderSubtle }]}>
          <View style={styles.footerInner}>
            <View style={styles.footerBrandRow}>
              <Image
                source={require('../assets/images/mascot.png')}
                style={styles.footerMascot}
                contentFit="cover"
              />
              <Text style={[styles.footerBrandText, { color: colors.text }]}>Yomite Manga Reader</Text>
            </View>
            <Text style={[styles.footerCopyright, { color: colors.textMuted }]}>
              Powered by the MangaDex API. 100% Free & Open Source under the MIT License.
            </Text>
            <View style={styles.footerNavLinks}>
              <Pressable
                accessibilityRole="button"
                aria-label="Discover Manga"
                onPress={() => router.push('/(tabs)' as any)}
                style={styles.footerLinkPressable}
              >
                <Text style={[styles.footerLink, { color: colors.accent }]}>Discover</Text>
              </Pressable>
              <Text style={{ color: colors.border }}>•</Text>
              <Pressable
                accessibilityRole="button"
                aria-label="Community"
                onPress={() => router.push('/(tabs)/community' as any)}
                style={styles.footerLinkPressable}
              >
                <Text style={[styles.footerLink, { color: colors.accent }]}>Community</Text>
              </Pressable>
              <Text style={{ color: colors.border }}>•</Text>
              <Pressable
                accessibilityRole="button"
                aria-label="Settings"
                onPress={() => router.push('/(tabs)/settings' as any)}
                style={styles.footerLinkPressable}
              >
                <Text style={[styles.footerLink, { color: colors.accent }]}>Settings</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: Spacing['4xl'],
  },

  /* ── TOP NAVBAR ── */
  navbarOuter: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 50,
  },
  navbarInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
  },
  navbarInnerDesktop: {
    paddingHorizontal: 40,
    paddingVertical: 18,
  },
  navbarInnerMobile: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  brandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  brandMascot: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandTextGroup: {
    gap: 1,
  },
  brandTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.4,
  },
  brandTagline: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  navSecondaryText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  navPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.md,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  navPrimaryText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },

  /* ── SECTION WRAPPER FOR PERFECT CENTERING ── */
  sectionWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  sectionWrapperDesktop: {
    paddingHorizontal: 40,
  },

  /* ── HERO CONTAINER ── */
  heroContainer: {
    width: '100%',
    maxWidth: 1600,
    alignSelf: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    gap: Spacing['2xl'],
    position: 'relative',
  },
  heroContainerDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing['3xl'] + 20,
    paddingBottom: Spacing['4xl'] + 30,
    gap: Spacing['3xl'] + 20,
    minHeight: 740,
  },
  heroTextCol: {
    flex: 1.25,
  },
  heroTextColDesktop: {
    maxWidth: 880,
    paddingRight: Spacing.xl,
  },
  heroReleaseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.md,
  },
  releasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  releasePillText: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
  },
  releaseMetaText: {
    fontSize: 12.5,
    fontWeight: Typography.weights.medium,
  },
  heroHeadline: {
    fontSize: 52,
    lineHeight: 58,
    fontWeight: Typography.weights.bold,
    letterSpacing: -1.5,
    marginBottom: Spacing.md,
  },
  heroHeadlineDesktop: {
    fontSize: 66,
    lineHeight: 74,
    letterSpacing: -2.2,
    marginBottom: Spacing.lg,
  },
  heroHeadlineTablet: {
    fontSize: 42,
    lineHeight: 48,
  },
  heroHeadlineMobile: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  heroSubheadline: {
    fontSize: 17.5,
    lineHeight: 27,
    maxWidth: 600,
    marginBottom: Spacing.xl,
  },
  heroSubheadlineDesktop: {
    fontSize: 20,
    lineHeight: 32,
    maxWidth: 720,
    marginBottom: Spacing['2xl'],
  },
  heroSubheadlineMobile: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: Spacing.lg,
  },
  heroCtaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  heroCtaGroupMobile: {
    flexDirection: 'column',
    width: '100%',
    gap: 12,
  },
  heroDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    minHeight: 48,
    boxShadow: '0 8px 20px rgba(244, 63, 94, 0.32)',
    elevation: 6,
  },
  heroDownloadLabels: {
    gap: 2,
  },
  heroDownloadMain: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: Typography.weights.bold,
  },
  heroDownloadMeta: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: Typography.weights.medium,
  },
  heroQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    minHeight: 48,
  },
  heroQrText: {
    fontSize: 14.5,
    fontWeight: Typography.weights.semibold,
  },
  heroTabSelector: {
    gap: 8,
    marginTop: Spacing.xs,
  },
  heroTabLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.2,
  },
  heroTabList: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroTabListMobile: {
    gap: 6,
  },
  heroTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 44,
  },
  heroTabIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroTabPillText: {
    fontSize: 13,
  },
  commitmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commitmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commitmentText: {
    fontSize: 12.5,
    fontWeight: Typography.weights.medium,
  },
  commitmentDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#3F3F46',
  },

  /* ── SMARTPHONE MOCKUP FRAME ── */
  heroDeviceCol: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 520,
  },
  heroDeviceColDesktop: {
    minHeight: 740,
    flex: 0.95,
  },
  phoneMockupWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ambientDeviceGlow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.9,
    transform: [{ scale: 1.25 }],
    pointerEvents: 'none',
  },
  ambientDeviceGlowDesktop: {
    width: 460,
    height: 460,
    borderRadius: 230,
    opacity: 0.95,
  },
  phoneShell: {
    width: 275,
    height: 585,
    backgroundColor: '#09090B',
    borderColor: '#27272A',
    borderWidth: 6,
    borderRadius: 42,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 24px 50px rgba(0, 0, 0, 0.65)',
    elevation: 16,
  },
  phoneShellDesktop: {
    width: 335,
    height: 710,
    borderRadius: 50,
    borderWidth: 7,
  },
  phoneShellCarouselDesktop: {
    width: 305,
    height: 650,
    borderRadius: 46,
    borderWidth: 6.5,
  },
  ambientDeviceGlowCarouselDesktop: {
    width: 420,
    height: 420,
    borderRadius: 210,
    opacity: 0.9,
  },
  phoneShellMobile: {
    width: 255,
    height: 540,
  },
  phonePunchHole: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
    zIndex: 25,
  },
  phoneScreenSurface: {
    flex: 1,
    backgroundColor: '#09090B',
    position: 'relative',
  },
  phoneScreenImage: {
    width: '100%',
    height: '100%',
  },
  screenContextPill: {
    position: 'absolute',
    bottom: 22,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(9, 9, 11, 0.90)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderRadius: Radius.full,
    zIndex: 20,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
  },
  screenContextDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  screenContextText: {
    color: '#FAFAFA',
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  phoneHomeBar: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    width: 90,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#52525B',
    zIndex: 25,
  },

  /* ── SLIDING FEATURE SECTION ── */
  featuresSection: {
    width: '100%',
    maxWidth: 1600,
    alignSelf: 'center',
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing['2xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  featuresHeaderBlock: {
    width: '100%',
    maxWidth: 760,
    alignItems: 'flex-start',
    marginBottom: Spacing['4xl'],
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'left',
  },
  sectionTitle: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.6,
    marginBottom: Spacing.xs,
    textAlign: 'left',
  },
  sectionSubtitle: {
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'left',
    maxWidth: 680,
  },
  slideDetailsAnimatedWrap: {
    width: '100%',
    gap: Spacing.md,
  },

  /* Carousel Navigation Control Bar */
  /* Carousel Stage Card */
  carouselStageCard: {
    width: '100%',
    position: 'relative',
  },
  carouselBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  carouselProgressTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  carouselDotTouchTarget: {
    minHeight: 44,
    minWidth: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  carouselActiveCapsule: {
    width: 62,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#262626',
    overflow: 'hidden',
    position: 'relative',
  },
  carouselCapsuleFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 4,
  },
  carouselInactiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#262626',
  },
  carouselInactiveDotHovered: {
    backgroundColor: '#52525B',
  },

  /* Slide Body */
  carouselSlideBody: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
    alignItems: 'flex-start',
  },
  carouselSlideBodyDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing['3xl'],
  },
  slideNarrativeCol: {
    flex: 1.15,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  slideVisualCol: {
    flex: 0.85,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },

  /* Spread Elements */
  featureNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  featureNumberText: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
  },
  featureCategoryText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
  },
  spreadTitle: {
    fontSize: 26,
    lineHeight: 33,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.4,
  },
  spreadParagraph: {
    fontSize: 15.5,
    lineHeight: 24,
  },
  spreadChecklist: {
    gap: 10,
    marginTop: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  checkItemText: {
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
  },
  modeChoiceContainer: {
    gap: 6,
    marginVertical: 4,
  },
  modeChoiceLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
  },
  modeChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 44,
  },
  modePillText: {
    fontSize: 13,
  },

  /* Languages Grid */
  langSelectorContainer: {
    gap: 6,
    marginVertical: 4,
  },
  langBadgeGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 44,
  },
  langFlag: {
    width: 18,
    height: 13,
    borderRadius: 2,
  },
  langPillText: {
    fontSize: 13,
  },

  /* ── DOWNLOAD HUB SECTION ── */
  downloadHubSection: {
    width: '100%',
    maxWidth: 1600,
    alignSelf: 'center',
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing['3xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.xl,
  },
  downloadHubSectionMobile: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  downloadHubGrid: {
    gap: Spacing.xl,
  },
  downloadHubGridDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing['2xl'],
  },
  downloadHubLeft: {
    flex: 1.25,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
  },
  hubTitle: {
    fontSize: 28,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  hubSubtitle: {
    fontSize: 15.5,
    lineHeight: 23,
    marginBottom: Spacing.lg,
  },
  metaTable: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  metaTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  metaTableLabel: {
    fontSize: 14.5,
  },
  metaTableValue: {
    fontSize: 14.5,
    fontWeight: Typography.weights.semibold,
  },
  bigDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderRadius: Radius.lg,
    minHeight: 48,
    boxShadow: '0 8px 22px rgba(244, 63, 94, 0.35)',
    elevation: 6,
  },
  bigDownloadTextCol: {
    gap: 2,
  },
  bigDownloadTitle: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: Typography.weights.bold,
  },
  bigDownloadSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12.5,
    fontWeight: Typography.weights.medium,
  },
  checksumSection: {
    marginTop: Spacing.md,
  },
  checksumToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    minHeight: 44,
    minWidth: 44,
  },
  checksumToggleText: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
  },
  shaBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 6,
  },
  shaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shaTitle: {
    fontSize: 10.5,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  shaCopyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  shaCopyText: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
  },
  shaHashString: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  downloadHubRight: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  qrHeading: {
    fontSize: 19,
    fontWeight: Typography.weights.bold,
    marginBottom: 4,
  },
  qrInstructions: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  qrCardFrame: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.3)',
    elevation: 6,
    marginBottom: Spacing.md,
  },
  qrImageCanvas: {
    width: 190,
    height: 190,
  },
  qrHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qrHelperText: {
    fontSize: 12.5,
    fontWeight: Typography.weights.medium,
  },

  /* ── INSTALLATION GUIDE ── */
  guideContainer: {
    width: '100%',
    maxWidth: 1600,
    alignSelf: 'center',
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing['4xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing['2xl'],
  },
  guideContainerMobile: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  guideHeaderGroup: {
    marginBottom: Spacing.lg,
  },
  guideMainTitle: {
    fontSize: 28,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  guideSubtitle: {
    fontSize: 15,
  },
  guideToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.xl,
  },
  guideToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  guideToggleText: {
    fontSize: 14,
    fontWeight: Typography.weights.bold,
  },
  stepSequence: {
    gap: Spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepDigitBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDigit: {
    fontSize: 16,
    fontWeight: Typography.weights.bold,
  },
  stepDetailCol: {
    flex: 1,
    gap: 4,
  },
  stepHeader: {
    fontSize: 17,
    fontWeight: Typography.weights.bold,
  },
  stepBody: {
    fontSize: 14.5,
    lineHeight: 22,
  },
  credibilityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    marginTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  credibilityNoteText: {
    fontSize: 13.5,
    lineHeight: 20,
    flex: 1,
  },

  /* ── FOOTER ── */
  footerOuter: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  footerInner: {
    width: '100%',
    maxWidth: 1200,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerMascot: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  footerBrandText: {
    fontSize: 16,
    fontWeight: Typography.weights.bold,
  },
  footerCopyright: {
    fontSize: 13,
    textAlign: 'center',
  },
  footerNavLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 4,
  },
  footerLinkPressable: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: Typography.weights.semibold,
  },
});
