/**
 * Yomite Mobile App Promotion & Direct Download Page
 * Aesthetic: Editorial Cyber-Minimalist (Swiss Dark Monolith)
 * Features: Realistic Device Mockup, Interactive Demo Tabs, Direct APK Download,
 * QR Code Sideloading, SHA-256 Checksum, and Step-by-Step Installation Guides.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../constants/Colors';
import { useThemeColors } from '../src/hooks/useThemeColor';
import { triggerHaptic } from '../src/utils/haptics';

// App Specifications & Release Metadata
const APP_RELEASE = {
  version: 'v1.2.0',
  buildNumber: '104',
  releaseDate: 'August 2026',
  fileSize: '118.86 MB',
  minAndroid: 'Android 8.0 (Oreo) or higher',
  minIos: 'iOS 15.0+ (via Web PWA)',
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  apkDownloadUrl: 'https://expo.dev/accounts/chiro14/projects/yomite/builds/dadb5395-cdcf-4bed-b288-b27bb3c5d878',
};

type DemoTab = 'reader' | 'offline' | 'languages' | 'library';

interface BentoAppearCardProps {
  index: number;
  isDesktop: boolean;
  style?: any;
  children: React.ReactNode;
}

function BentoAppearCard({ index, isDesktop, style, children }: BentoAppearCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const delay = 80 + index * 70; // Emil Stagger: 70ms step with natural cubic bezier
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 460,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 460,
          easing: Easing.bezier(0.23, 1, 0.32, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <Animated.View
      style={[
        styles.featureCard,
        isDesktop && styles.featureCardDesktop,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        Platform.OS === 'web' && hovered && styles.featureCardHovered,
        style,
      ]}
      // @ts-ignore
      onMouseEnter={() => setHovered(true)}
      // @ts-ignore
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Animated.View>
  );
}

export default function AppDownloadScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 900;
  const isTablet = windowWidth >= 640 && windowWidth < 900;
  const isMobile = windowWidth < 640;
  const phoneStageScale = isDesktop ? 1 : Math.min(1, Math.max(0.70, (windowWidth - 32) / 400));

  const [activeTab, setActiveTab] = useState<DemoTab>('reader');
  const [hoveredPhoneTab, setHoveredPhoneTab] = useState<DemoTab | null>(null);
  const [hoveredPill, setHoveredPill] = useState<DemoTab | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef<any>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  // Interactive Demo State
  const [featureReaderMode, setFeatureReaderMode] = useState<'webtoon' | 'rtl' | 'spread'>('webtoon');
  const [featureLang, setFeatureLang] = useState('en');
  const [activeGuideTab, setActiveGuideTab] = useState<'android' | 'ios'>('android');

  const handleSelectTab = (tab: DemoTab) => {
    if (tab === activeTab) return;
    triggerHaptic();
    setIsTransitioning(true);
    setActiveTab(tab);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 450);
  };

  const handleDownloadApk = () => {
    triggerHaptic();
    if (Platform.OS === 'web') {
      window.open(APP_RELEASE.apkDownloadUrl, '_blank');
    } else {
      Linking.openURL(APP_RELEASE.apkDownloadUrl);
    }
  };

  const handleCopySha = () => {
    triggerHaptic();
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(APP_RELEASE.sha256);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    }
  };

const MOCK_PREVIEW_IMAGES: Record<DemoTab, any> = {
  reader: require('../assets/images/reader_image.png'),
  offline: require('../assets/images/offline_vault.png'),
  languages: require('../assets/images/language_options.png'),
  library: require('../assets/images/cloud_libary.png'),
};

  const renderMockScreenContent = (tabId: DemoTab) => {
    const imageSource = MOCK_PREVIEW_IMAGES[tabId];
    return (
      <View style={styles.mockScreenImageContainer}>
        <Image
          source={imageSource}
          style={styles.mockScreenImage}
          contentFit="cover"
          transition={250}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Top Navbar */}
      <View
        style={[
          styles.navbar,
          { borderBottomColor: colors.borderSubtle, backgroundColor: colors.background },
          isMobile && { paddingHorizontal: 12, height: 58 },
        ]}
      >
        <View style={styles.navLeft}>
          <Pressable
            onPress={() => router.push('/(tabs)' as any)}
            style={({ pressed }) => [styles.logoBtn, pressed && { opacity: 0.8 }]}
          >
            <Image
              source={require('../assets/images/mascot.png')}
              style={[styles.logoMascot, isMobile && { width: 28, height: 28 }]}
              contentFit="cover"
            />
            <Text style={[styles.logoText, { color: colors.text }, isMobile && { fontSize: 18 }]}>Yomite</Text>
            {!isMobile && (
              <View style={[styles.versionPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Text style={[styles.versionPillText, { color: colors.accent }]}>MOBILE</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={[styles.navRight, isMobile && { gap: 8 }]}>
          <Pressable
            onPress={() => router.push('/(tabs)' as any)}
            style={({ pressed }) => [
              styles.navLinkBtn,
              { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
              isMobile && { paddingHorizontal: 10, paddingVertical: 6 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="arrow-back" size={14} color={colors.text} />
            <Text style={[styles.navLinkText, { color: colors.text }, isMobile && { fontSize: 12 }]}>
              {isMobile ? 'Back' : 'Web App'}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleDownloadApk}
            style={({ pressed }) => [
              styles.navPrimaryBtn,
              { backgroundColor: colors.accent },
              isMobile && { paddingHorizontal: 12, paddingVertical: 7 },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Ionicons name="download-outline" size={15} color="#FFFFFF" />
            <Text style={[styles.navPrimaryBtnText, isMobile && { fontSize: 12 }]}>
              {isMobile ? 'APK' : 'Download APK'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* UNIFIED HERO SECTION: LEFT TEXT & CTA / RIGHT STANDALONE PHONE */}
        <View style={[styles.unifiedHeroSection, isDesktop && [styles.unifiedHeroDesktop, { minHeight: Math.max(windowHeight - 72, 850) }]]}>
          {/* LEFT COLUMN: HERO CONTENT & CTA */}
          <View style={[styles.heroLeftCol, isDesktop && styles.heroLeftColDesktop]}>
            <View style={[styles.heroBadgeRow, isMobile && { gap: 6, flexWrap: 'wrap' }]}>
              <View style={[styles.liveReleaseBadge, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }, isMobile && { paddingHorizontal: 8, paddingVertical: 4 }]}>
                <View style={[styles.pulseDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.liveReleaseBadgeText, { color: colors.accent }, isMobile && { fontSize: 11 }]}>
                  {APP_RELEASE.version} {isMobile ? 'RELEASE' : 'OFFICIAL RELEASE'}
                </Text>
              </View>
              <View style={[styles.osTag, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, isMobile && { paddingHorizontal: 8, paddingVertical: 4 }]}>
                <Ionicons name="logo-android" size={12} color="#22C55E" />
                <Text style={[styles.osTagText, { color: colors.textSecondary }, isMobile && { fontSize: 11 }]}>Android</Text>
              </View>
              <View style={[styles.osTag, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, isMobile && { paddingHorizontal: 8, paddingVertical: 4 }]}>
                <Ionicons name="logo-apple" size={12} color={colors.text} />
                <Text style={[styles.osTagText, { color: colors.textSecondary }, isMobile && { fontSize: 11 }]}>iOS PWA</Text>
              </View>
            </View>

            <Text style={[styles.heroHeadline, { color: colors.text }, isMobile && { fontSize: 30, lineHeight: 36 }]}>
              The Ultimate Manga Reader.{'\n'}
              <Text style={{ color: colors.accent }}>Pure, Offline, Free.</Text>
            </Text>

            <Text style={[styles.heroSubheadline, { color: colors.textSecondary }, isMobile && { fontSize: 14, lineHeight: 20 }]}>
              Experience lightning-fast 60fps reading, 1-click full chapter downloads, 30+ translation languages, and real-time cloud sync across your devices. No paywalls, no popups.
            </Text>

            {/* Quick CTA Actions */}
            <View style={[styles.heroCtaRow, isMobile && { flexDirection: 'column', gap: 10, width: '100%' }]}>
              <Pressable
                onPress={handleDownloadApk}
                style={({ pressed }) => [
                  styles.primaryDownloadBtn,
                  { backgroundColor: colors.accent },
                  isMobile && { width: '100%', justifyContent: 'center' },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <View style={styles.primaryDownloadIconWrap}>
                  <Ionicons name="logo-android" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.primaryDownloadCol}>
                  <Text style={styles.primaryDownloadLabel}>Download Direct APK</Text>
                  <Text style={styles.primaryDownloadMeta}>
                    {APP_RELEASE.version} • {APP_RELEASE.fileSize}
                  </Text>
                </View>
                <Ionicons name="arrow-down-circle" size={22} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </Pressable>

              {!isMobile && (
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    const qrElem = document.getElementById('qr-section');
                    if (qrElem) qrElem.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={({ pressed }) => [
                    styles.secondaryQrBtn,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="qr-code-outline" size={20} color={colors.text} />
                  <Text style={[styles.secondaryQrBtnText, { color: colors.text }]}>Scan QR from Phone</Text>
                </Pressable>
              )}
            </View>

            {/* Interactive Feature Demo Pills on the Left */}
            <View style={styles.heroSlideSelector}>
              <Text style={[styles.heroSlideSelectorLabel, { color: colors.textMuted }]}>
                CLICK TO PREVIEW APP SCREENS
              </Text>
              <View style={[styles.slideSwitcherRow, isMobile && { flexWrap: 'wrap', gap: 8 }]}>
                {[
                  { id: 'reader' as const, num: '01', title: '60fps Reader', icon: 'book-outline' as const },
                  { id: 'offline' as const, num: '02', title: 'Offline Vault', icon: 'download-outline' as const },
                  { id: 'languages' as const, num: '03', title: '30+ Languages', icon: 'globe-outline' as const },
                  { id: 'library' as const, num: '04', title: 'Cloud Library', icon: 'sync-outline' as const },
                ].map((slide) => {
                  const isSelected = activeTab === slide.id;
                  const isHovered = hoveredPill === slide.id;
                  return (
                    <Pressable
                      key={slide.id}
                      onPress={() => {
                        handleSelectTab(slide.id);
                      }}
                      onHoverIn={() => setHoveredPill(slide.id)}
                      onHoverOut={() => setHoveredPill(null)}
                      style={[
                        styles.slideIndicatorPill,
                        isMobile && { flex: 1, minWidth: '45%' },
                        {
                          backgroundColor: isSelected
                            ? colors.surfaceElevated
                            : isHovered
                            ? 'rgba(244, 63, 94, 0.08)'
                            : 'transparent',
                          borderColor: isSelected
                            ? colors.accent
                            : isHovered
                            ? colors.accent
                            : colors.borderSubtle,
                          transform: isHovered && !isSelected ? [{ translateY: -2 }, { scale: 1.04 }] : [{ scale: 1 }],
                        },
                        Platform.OS === 'web' && {
                          // @ts-ignore
                          transition: 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
                          cursor: 'pointer',
                        },
                      ]}
                    >
                      <View style={[styles.slideDot, { backgroundColor: isSelected || isHovered ? colors.accent : colors.border }]} />
                      <Text style={[styles.slideNumberText, { color: isSelected || isHovered ? colors.accent : colors.textMuted }]}>
                        {slide.num}
                      </Text>
                      <Text
                        style={[
                          styles.slideTitleText,
                          {
                            color: isSelected || isHovered ? colors.text : colors.textSecondary,
                            fontWeight: isSelected ? Typography.weights.bold : Typography.weights.medium,
                          },
                        ]}
                      >
                        {slide.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Trust Matrix & Feature Highlights in Hero */}
            <View style={[styles.heroTrustGrid, isMobile && { flexDirection: 'column', gap: 8 }]}>
              <View style={[styles.heroTrustCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }, isMobile && { width: '100%' }]}>
                <View style={[styles.heroTrustIconWrap, { backgroundColor: 'rgba(244, 63, 94, 0.12)' }]}>
                  <Ionicons name="shield-checkmark" size={16} color="#F43F5E" />
                </View>
                <View style={styles.heroTrustContent}>
                  <Text style={[styles.heroTrustTitle, { color: colors.text }]}>100% Free Forever</Text>
                  <Text style={[styles.heroTrustSub, { color: colors.textSecondary }]}>Zero ads & popups</Text>
                </View>
              </View>

              <View style={[styles.heroTrustCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }, isMobile && { width: '100%' }]}>
                <View style={[styles.heroTrustIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Ionicons name="flash" size={16} color="#10B981" />
                </View>
                <View style={styles.heroTrustContent}>
                  <Text style={[styles.heroTrustTitle, { color: colors.text }]}>Instant Startup</Text>
                  <Text style={[styles.heroTrustSub, { color: colors.textSecondary }]}>Sub-second boot & cache</Text>
                </View>
              </View>

              <View style={[styles.heroTrustCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }, isMobile && { width: '100%' }]}>
                <View style={[styles.heroTrustIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                  <Ionicons name="sync" size={16} color="#3B82F6" />
                </View>
                <View style={styles.heroTrustContent}>
                  <Text style={[styles.heroTrustTitle, { color: colors.text }]}>Universal Sync</Text>
                  <Text style={[styles.heroTrustSub, { color: colors.textSecondary }]}>Seamless Mobile ↔ Web</Text>
                </View>
              </View>
            </View>

            {/* Architecture & Compatibility Badges Shelf */}
            <View style={[styles.heroArchRow, isMobile && { flexWrap: 'wrap', gap: 6 }]}>
              <View style={[styles.heroArchBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
                <Ionicons name="hardware-chip-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.heroArchText, { color: colors.textSecondary }]}>ARM64 / x86_64</Text>
              </View>
              <View style={[styles.heroArchBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
                <Ionicons name="phone-portrait-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.heroArchText, { color: colors.textSecondary }]}>Android 8.0 - 15+</Text>
              </View>
              <View style={[styles.heroArchBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
                <Ionicons name="tablet-landscape-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.heroArchText, { color: colors.textSecondary }]}>Tablets & Foldables</Text>
              </View>
              <View style={[styles.heroArchBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
                <Ionicons name="checkmark-done" size={12} color="#10B981" />
                <Text style={[styles.heroArchText, { color: '#10B981' }]}>Clean APK (0 Trackers)</Text>
              </View>
            </View>
          </View>

          {/* RIGHT COLUMN: STANDALONE PHONE SHOWCASE */}
          <View style={styles.heroRightCol}>
            {/* Ambient Glow Backdrop */}
            <View style={styles.ambientGlow} />

            {/* 3D Stacked Coverflow Stage with Interactive Hover & Tap Controls */}
            <View
              style={[
                styles.phoneCarouselStage,
                isDesktop && styles.phoneCarouselStageDesktop,
                !isDesktop && {
                  transform: [{ scale: phoneStageScale }],
                  marginVertical: isMobile ? -Math.round((1 - phoneStageScale) * 260) : 0,
                },
              ]}
            >
              {/* 4 Stacked Phones in 3D Space */}
              {(['reader', 'offline', 'languages', 'library'] as DemoTab[]).map((tabId, i) => {
                const tabs: DemoTab[] = ['reader', 'offline', 'languages', 'library'];
                const activeIdx = tabs.indexOf(activeTab);
                const diff = (i - activeIdx + 4) % 4;
                const isCenter = diff === 0;
                const isRight = diff === 1;
                const isBack = diff === 2;
                const isLeft = diff === 3;
                const isHovered = !isTransitioning && hoveredPhoneTab === tabId && !isCenter;

                // 3D Transforms based on position in stack & hover state
                let transformStyle: any;
                let zIndex = 1;
                let opacity = 1;
                let borderColor = isHovered ? '#F43F5E' : '#27272A';

                if (isCenter) {
                  transformStyle = [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }, { rotate: '0deg' }];
                  zIndex = 10;
                  opacity = 1;
                  borderColor = '#27272A';
                } else if (isRight) {
                  transformStyle = isHovered
                    ? [
                        { translateX: isDesktop ? 138 : isMobile ? 54 : 74 },
                        { translateY: isDesktop ? 10 : 4 },
                        { scale: isDesktop ? 0.90 : 0.85 },
                        { rotate: '8deg' },
                      ]
                    : [
                        { translateX: isDesktop ? 125 : isMobile ? 48 : 65 },
                        { translateY: isDesktop ? 22 : 12 },
                        { scale: isDesktop ? 0.86 : 0.82 },
                        { rotate: '11deg' },
                      ];
                  zIndex = isHovered ? 8 : 6;
                  opacity = isHovered ? 1 : 0.85;
                } else if (isLeft) {
                  transformStyle = isHovered
                    ? [
                        { translateX: isDesktop ? -138 : isMobile ? -54 : -74 },
                        { translateY: isDesktop ? 10 : 4 },
                        { scale: isDesktop ? 0.90 : 0.85 },
                        { rotate: '-8deg' },
                      ]
                    : [
                        { translateX: isDesktop ? -125 : isMobile ? -48 : -65 },
                        { translateY: isDesktop ? 22 : 12 },
                        { scale: isDesktop ? 0.86 : 0.82 },
                        { rotate: '-11deg' },
                      ];
                  zIndex = isHovered ? 8 : 6;
                  opacity = isHovered ? 1 : 0.85;
                } else {
                  // isBack (diff === 2)
                  transformStyle = isHovered
                    ? [
                        { translateX: 0 },
                        { translateY: isDesktop ? -38 : -20 },
                        { scale: isDesktop ? 0.82 : 0.78 },
                        { rotate: '0deg' },
                      ]
                    : [
                        { translateX: 0 },
                        { translateY: isDesktop ? -26 : -14 },
                        { scale: isDesktop ? 0.76 : 0.72 },
                        { rotate: '0deg' },
                      ];
                  zIndex = isHovered ? 5 : 3;
                  opacity = isHovered ? 0.95 : 0.65;
                }

                return (
                  <Pressable
                    key={tabId}
                    disabled={isCenter || isTransitioning}
                    onPress={() => {
                      handleSelectTab(tabId);
                    }}
                    onHoverIn={() => {
                      if (!isTransitioning && !isCenter) {
                        setHoveredPhoneTab(tabId);
                      }
                    }}
                    onHoverOut={() => {
                      setHoveredPhoneTab(null);
                    }}
                    style={[
                      styles.standalonePhoneShell,
                      styles.iphoneShell,
                      {
                        zIndex,
                        opacity,
                        borderColor,
                        transform: transformStyle,
                      },
                      isHovered && {
                        boxShadow: '0 0 36px rgba(244, 63, 94, 0.5)',
                      },
                      Platform.OS === 'web' && {
                        // @ts-ignore
                        transition: 'all 0.35s cubic-bezier(0.23, 1, 0.32, 1)',
                        cursor: isCenter ? 'default' : 'pointer',
                      },
                    ]}
                  >
                    {/* iPhone 16 Dynamic Island Notch */}
                    <View style={styles.dynamicIsland}>
                      <View style={styles.dynamicIslandSensor} />
                      <View style={styles.dynamicIslandCamera} />
                    </View>

                    {/* Phone Screen Mock Content */}
                    <View style={styles.mockupScreenInner}>
                      {renderMockScreenContent(tabId)}
                    </View>

                    {/* Bottom Home Indicator */}
                    <View style={styles.homeIndicator} />

                    {/* Click-to-bring-to-front Overlay on Side/Back Phones */}
                    {!isCenter && (
                      <View style={styles.stackedPhoneDimOverlay}>
                        <View
                          style={[
                            styles.stackedPhoneBadge,
                            {
                              backgroundColor: isHovered ? colors.surface : colors.surfaceElevated,
                              borderColor: isHovered ? colors.accent : colors.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              tabId === 'reader'
                                ? 'book-outline'
                                : tabId === 'offline'
                                ? 'download-outline'
                                : tabId === 'languages'
                                ? 'globe-outline'
                                : 'sync-outline'
                            }
                            size={12}
                            color={colors.accent}
                          />
                          <Text style={[styles.stackedPhoneBadgeText, { color: colors.text }]}>
                            {tabId === 'reader'
                              ? '60fps Reader'
                              : tabId === 'offline'
                              ? 'Offline Vault'
                              : tabId === 'languages'
                              ? '30+ Languages'
                              : 'Cloud Library'}
                          </Text>
                        </View>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* FEATURE MATRIX (Bento 2x2 High-Craft Interactive Showcase) */}
        <View id="features-section" style={styles.featuresSection}>
          <View style={styles.featuresHeaderRow}>
            <View>
              <Text style={[styles.featuresPretitle, { color: colors.accent }]}>ENGINEERED FOR MANGA PURISTS</Text>
              <Text style={[styles.featuresTitle, { color: colors.text }]}>Why Yomite Mobile is Different</Text>
            </View>
            <View style={[styles.bentoMatrixBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={[styles.pulseDotGreen, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.bentoMatrixBadgeText, { color: colors.textSecondary }]}>NATIVE ARCHITECTURE</Text>
            </View>
          </View>

          <View style={[styles.featureGrid, isDesktop && styles.featureGridDesktop]}>
            {/* ── CARD 1: 60FPS GPU ENGINE ── */}
            <BentoAppearCard index={0} isDesktop={isDesktop} style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View style={styles.featureCardTopRow}>
                <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(244, 63, 94, 0.12)' }]}>
                  <Ionicons name="hardware-chip-outline" size={22} color="#F43F5E" />
                </View>
                <View style={[styles.featureMetricPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <View style={[styles.pulseDotGreen, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.featureMetricPillText, { color: '#10B981' }]}>60.0 FPS • 16.6ms</Text>
                </View>
              </View>

              <Text style={[styles.featureCardTitle, { color: colors.text }]}>60fps GPU-Accelerated Engine</Text>
              <Text style={[styles.featureCardDesc, { color: colors.textSecondary }]}>
                Smooth continuous long-strip webtoon scrolling, authentic right-to-left manga page-turn physics, and dual-page landscape mode with zero stutter.
              </Text>

              {/* Mini Interactive Demo Widget */}
              <View style={[styles.miniWidgetBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
                <View style={styles.miniWidgetHeader}>
                  <Text style={[styles.miniWidgetLabel, { color: colors.textMuted }]}>READER ENGINE PREVIEW</Text>
                  <Text style={[styles.miniWidgetStatus, { color: '#F43F5E' }]}>GPU ACTIVE</Text>
                </View>

                <View style={styles.miniModeSwitchRow}>
                  {[
                    { id: 'webtoon' as const, label: 'Webtoon', icon: 'reorder-two-outline' as const },
                    { id: 'rtl' as const, label: 'RTL Manga', icon: 'arrow-back-outline' as const },
                    { id: 'spread' as const, label: 'Dual Spread', icon: 'book-outline' as const },
                  ].map((mode) => {
                    const isActive = featureReaderMode === mode.id;
                    return (
                      <Pressable
                        key={mode.id}
                        onPress={() => {
                          triggerHaptic();
                          setFeatureReaderMode(mode.id);
                        }}
                        style={[
                          styles.miniModePill,
                          {
                            backgroundColor: isActive ? '#F43F5E20' : colors.surface,
                            borderColor: isActive ? '#F43F5E' : colors.border,
                          },
                        ]}
                      >
                        <Ionicons name={mode.icon} size={12} color={isActive ? '#F43F5E' : colors.textMuted} />
                        <Text style={[styles.miniModePillText, { color: isActive ? colors.text : colors.textSecondary }]}>
                          {mode.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.fpsSimCanvas}>
                  <View style={styles.fpsSimBarGroup}>
                    {[45, 60, 58, 60, 60, 59, 60, 60, 60, 59, 60, 60, 60, 60, 60].map((val, i) => (
                      <View
                        key={i}
                        style={[
                          styles.fpsSimBar,
                          {
                            height: (val / 60) * 18,
                            backgroundColor: val >= 58 ? '#10B981' : '#F59E0B',
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.fpsSimNote, { color: colors.textMuted }]}>
                    Zero frame drops during rapid multi-touch drag & pinch zoom
                  </Text>
                </View>
              </View>
            </BentoAppearCard>

            {/* ── CARD 2: TRUE OFFLINE CHAPTER VAULT ── */}
            <BentoAppearCard index={1} isDesktop={isDesktop} style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View style={styles.featureCardTopRow}>
                <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Ionicons name="airplane-outline" size={22} color="#10B981" />
                </View>
                <View style={[styles.featureMetricPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                  <Text style={[styles.featureMetricPillText, { color: '#10B981' }]}>100% Offline Disk</Text>
                </View>
              </View>

              <Text style={[styles.featureCardTitle, { color: colors.text }]}>True Offline Chapter Vault</Text>
              <Text style={[styles.featureCardDesc, { color: colors.textSecondary }]}>
                Batch-download entire story arcs in one tap. Encrypted local disk storage lets you read uninterrupted on flights, subways, and off-grid trips.
              </Text>

              {/* Mini Interactive Demo Widget */}
              <View style={[styles.miniWidgetBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
                <View style={styles.miniWidgetHeader}>
                  <Text style={[styles.miniWidgetLabel, { color: colors.textMuted }]}>ACTIVE DOWNLOAD QUEUE</Text>
                  <Text style={[styles.miniWidgetStatus, { color: '#10B981' }]}>24.8 MB/s</Text>
                </View>

                <View style={styles.vaultProgressBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.vaultMangaTitle, { color: colors.text }]} numberOfLines={1}>
                      Solo Leveling: Ragnarok
                    </Text>
                    <Text style={[styles.vaultPercentText, { color: '#10B981' }]}>84%</Text>
                  </View>
                  <Text style={[styles.vaultChapterSub, { color: colors.textMuted }]}>
                    Ch. 1 - 20 (Batch Arc) • 24.8 MB/s
                  </Text>
                  <View style={[styles.vaultProgressBarBg, { backgroundColor: colors.surface }]}>
                    <View style={[styles.vaultProgressBarFill, { width: '84%', backgroundColor: '#10B981' }]} />
                  </View>
                </View>

                <View style={styles.vaultTagsRow}>
                  <View style={[styles.vaultTagPill, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="airplane" size={11} color="#10B981" />
                    <Text style={[styles.vaultTagPillText, { color: colors.textSecondary }]}>Airplane Ready</Text>
                  </View>
                  <View style={[styles.vaultTagPill, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="lock-closed" size={11} color="#10B981" />
                    <Text style={[styles.vaultTagPillText, { color: colors.textSecondary }]}>Encrypted Disk</Text>
                  </View>
                  <View style={[styles.vaultTagPill, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="flash" size={11} color="#10B981" />
                    <Text style={[styles.vaultTagPillText, { color: colors.textSecondary }]}>Zero Buffering</Text>
                  </View>
                </View>
              </View>
            </BentoAppearCard>

            {/* ── CARD 3: 30+ TRANSLATIONS ── */}
            <BentoAppearCard index={2} isDesktop={isDesktop} style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View style={styles.featureCardTopRow}>
                <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                  <Ionicons name="language-outline" size={22} color="#3B82F6" />
                </View>
                <View style={[styles.featureMetricPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <Ionicons name="globe-outline" size={12} color="#3B82F6" />
                  <Text style={[styles.featureMetricPillText, { color: '#3B82F6' }]}>30+ Languages</Text>
                </View>
              </View>

              <Text style={[styles.featureCardTitle, { color: colors.text }]}>Global Community Translations</Text>
              <Text style={[styles.featureCardDesc, { color: colors.textSecondary }]}>
                Instant access to official and community scanlation groups across 30+ languages directly from MangaDex with zero ads and zero paywalls.
              </Text>

              {/* Mini Interactive Demo Widget */}
              <View style={[styles.miniWidgetBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
                <View style={styles.miniWidgetHeader}>
                  <Text style={[styles.miniWidgetLabel, { color: colors.textMuted }]}>TAP TO SWITCH SCANLATION LANGUAGE</Text>
                  <Text style={[styles.miniWidgetStatus, { color: '#3B82F6' }]}>MANGADEX API</Text>
                </View>

                <View style={styles.miniLangGrid}>
                  {[
                    { code: 'en', name: 'English', countryCode: 'us' },
                    { code: 'es', name: 'Español', countryCode: 'es' },
                    { code: 'id', name: 'Indonesia', countryCode: 'id' },
                    { code: 'ja', name: '日本語', countryCode: 'jp' },
                    { code: 'pt-br', name: 'Português', countryCode: 'br' },
                    { code: 'fr', name: 'Français', countryCode: 'fr' },
                  ].map((lang) => {
                    const isSelected = featureLang === lang.code;
                    const flagUrl = `https://flagcdn.com/w40/${lang.countryCode}.png`;
                    return (
                      <Pressable
                        key={lang.code}
                        onPress={() => {
                          triggerHaptic();
                          setFeatureLang(lang.code);
                        }}
                        style={[
                          styles.miniLangPill,
                          {
                            backgroundColor: isSelected ? '#3B82F620' : colors.surface,
                            borderColor: isSelected ? '#3B82F6' : colors.border,
                          },
                        ]}
                      >
                        <Image
                          source={{ uri: flagUrl }}
                          style={styles.miniLangFlagImg}
                          contentFit="cover"
                        />
                        <Text style={[styles.miniLangText, { color: isSelected ? colors.text : colors.textSecondary }]}>
                          {lang.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.miniLangFooter}>
                  <Ionicons name="checkmark-circle" size={13} color="#3B82F6" />
                  <Text style={[styles.miniLangFooterText, { color: colors.textMuted }]}>
                    Filtered to <Text style={{ color: colors.text, fontWeight: 'bold' }}>{featureLang.toUpperCase()}</Text> chapters • Instant chapter releases
                  </Text>
                </View>
              </View>
            </BentoAppearCard>

            {/* ── CARD 4: REALTIME CLOUD SYNC ── */}
            <BentoAppearCard index={3} isDesktop={isDesktop} style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <View style={styles.featureCardTopRow}>
                <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Ionicons name="sync-outline" size={22} color="#F59E0B" />
                </View>
                <View style={[styles.featureMetricPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <View style={[styles.pulseDotGreen, { backgroundColor: '#F59E0B' }]} />
                  <Text style={[styles.featureMetricPillText, { color: '#F59E0B' }]}>Supabase Realtime</Text>
                </View>
              </View>

              <Text style={[styles.featureCardTitle, { color: colors.text }]}>Realtime Cloud Library Sync</Text>
              <Text style={[styles.featureCardDesc, { color: colors.textSecondary }]}>
                Pick up on your phone exactly where you left off on desktop. Bookmarks, history, and unread chapter badges sync seamlessly in under 50ms.
              </Text>

              {/* Mini Interactive Demo Widget */}
              <View style={[styles.miniWidgetBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
                <View style={styles.miniWidgetHeader}>
                  <Text style={[styles.miniWidgetLabel, { color: colors.textMuted }]}>DEVICE CLOUD TOPOLOGY</Text>
                  <Text style={[styles.miniWidgetStatus, { color: '#F59E0B' }]}>CONNECTED</Text>
                </View>

                {/* Device sync connection graph */}
                <View style={styles.syncTopologyRow}>
                  <View style={[styles.syncDeviceBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="phone-portrait-outline" size={16} color={colors.text} />
                    <Text style={[styles.syncDeviceName, { color: colors.text }]}>Android APK</Text>
                    <Text style={[styles.syncDeviceSub, { color: '#10B981' }]}>Page 14</Text>
                  </View>

                  <View style={styles.syncConnectorWrap}>
                    <View style={[styles.syncConnectorLine, { backgroundColor: '#F59E0B' }]} />
                    <View style={[styles.syncPulsePill, { backgroundColor: '#F59E0B20', borderColor: '#F59E0B' }]}>
                      <Ionicons name="flash" size={10} color="#F59E0B" />
                      <Text style={styles.syncPulseText}>12ms</Text>
                    </View>
                  </View>

                  <View style={[styles.syncDeviceBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="laptop-outline" size={16} color={colors.text} />
                    <Text style={[styles.syncDeviceName, { color: colors.text }]}>Desktop Web</Text>
                    <Text style={[styles.syncDeviceSub, { color: '#10B981' }]}>Synced</Text>
                  </View>
                </View>

                <View style={styles.syncItemPillRow}>
                  <View style={[styles.syncItemPill, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="bookmark" size={11} color="#F59E0B" />
                    <Text style={[styles.syncItemPillText, { color: colors.textSecondary }]}>Library (18)</Text>
                  </View>
                  <View style={[styles.syncItemPill, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="time" size={11} color="#F59E0B" />
                    <Text style={[styles.syncItemPillText, { color: colors.textSecondary }]}>History (42)</Text>
                  </View>
                  <View style={[styles.syncItemPill, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="notifications" size={11} color="#F59E0B" />
                    <Text style={[styles.syncItemPillText, { color: colors.textSecondary }]}>Unread Badges</Text>
                  </View>
                </View>
              </View>
            </BentoAppearCard>
          </View>
        </View>

        {/* DIRECT APK DOWNLOAD & SPECS SECTION */}
        <View
          id="qr-section"
          style={[
            styles.specsSection,
            { backgroundColor: colors.surface, borderColor: colors.border },
            isMobile && { width: '95%', padding: 16 },
          ]}
        >
          <View style={[styles.specsGrid, isDesktop && styles.specsGridDesktop]}>
            {/* Left: Release Card */}
            <View style={styles.specsColLeft}>
              <View style={[styles.releaseHeaderBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                <Text style={[styles.releaseHeaderBadgeText, { color: colors.text }]}>Verified Release Build</Text>
              </View>

              <Text style={[styles.specsTitle, { color: colors.text }]}>
                Yomite for Android
              </Text>
              <Text style={[styles.specsSubtitle, { color: colors.textSecondary }]}>
                Direct APK sideload package with zero telemetry and automatic in-app updates.
              </Text>

              {/* Meta Table */}
              <View style={[styles.specsTable, { borderColor: colors.borderSubtle }]}>
                <View style={styles.specsTableRow}>
                  <Text style={[styles.specsTableLabel, { color: colors.textMuted }]}>Version</Text>
                  <Text style={[styles.specsTableValue, { color: colors.text }]}>{APP_RELEASE.version} (Build {APP_RELEASE.buildNumber})</Text>
                </View>
                <View style={styles.specsTableRow}>
                  <Text style={[styles.specsTableLabel, { color: colors.textMuted }]}>File Size</Text>
                  <Text style={[styles.specsTableValue, { color: colors.text }]}>{APP_RELEASE.fileSize}</Text>
                </View>
                <View style={styles.specsTableRow}>
                  <Text style={[styles.specsTableLabel, { color: colors.textMuted }]}>Requirements</Text>
                  <Text style={[styles.specsTableValue, { color: colors.text }]}>{APP_RELEASE.minAndroid}</Text>
                </View>
                <View style={styles.specsTableRow}>
                  <Text style={[styles.specsTableLabel, { color: colors.textMuted }]}>License</Text>
                  <Text style={[styles.specsTableValue, { color: colors.text }]}>Open Source (MIT)</Text>
                </View>
              </View>

              {/* SHA-256 Checksum Card */}
              <View style={[styles.shaCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <View style={styles.shaHeader}>
                  <Text style={[styles.shaLabel, { color: colors.textMuted }]}>SHA-256 CHECKSUM</Text>
                  <Pressable onPress={handleCopySha} style={styles.shaCopyBtn}>
                    <Ionicons name={copiedSha ? 'checkmark' : 'copy-outline'} size={13} color={copiedSha ? '#10B981' : colors.accent} />
                    <Text style={[styles.shaCopyBtnText, { color: copiedSha ? '#10B981' : colors.accent }]}>
                      {copiedSha ? 'Copied!' : 'Copy Hash'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.shaValue, { color: colors.textSecondary }]} numberOfLines={1}>
                  {APP_RELEASE.sha256}
                </Text>
              </View>

              <Pressable
                onPress={handleDownloadApk}
                style={({ pressed }) => [
                  styles.directDownloadBtnBig,
                  { backgroundColor: colors.accent },
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Ionicons name="arrow-down-circle" size={22} color="#FFFFFF" />
                <Text style={[styles.directDownloadBtnBigText, isMobile && { fontSize: 15 }]}>
                  Download {APP_RELEASE.version} APK ({APP_RELEASE.fileSize})
                </Text>
              </Pressable>
            </View>

            {/* Right: QR Code Scanner for Phone Installation */}
            <View style={[styles.specsColRight, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.qrTitle, { color: colors.text }]}>Install from Phone</Text>
              <Text style={[styles.qrSub, { color: colors.textSecondary }]}>
                Scan with your Android camera or QR reader to download directly onto your device:
              </Text>

              {/* SVG / Image Simulated QR Code with Logo Badge */}
              <View style={styles.qrCodeFrame}>
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(APP_RELEASE.apkDownloadUrl)}&bgcolor=FFFFFF&color=09090B&margin=8`,
                  }}
                  style={styles.qrImage}
                  contentFit="contain"
                />
              </View>

              <View style={styles.qrInfoBadge}>
                <Ionicons name="phone-portrait-outline" size={14} color={colors.accent} />
                <Text style={[styles.qrInfoBadgeText, { color: colors.textSecondary }]}>
                  Point camera • Tap notification to install
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* INSTALLATION GUIDE ACCORDION */}
        <View
          style={[
            styles.guideSection,
            { backgroundColor: colors.surface, borderColor: colors.border },
            isMobile && { width: '95%', padding: 16 },
          ]}
        >
          <Text style={[styles.guidePretitle, { color: colors.accent }]}>STEP-BY-STEP INSTRUCTIONS</Text>
          <Text style={[styles.guideTitle, { color: colors.text }]}>How to Install Yomite</Text>

          {/* 100% Virus-Free Security Trust Banner */}
          <View style={[styles.virusFreeBanner, { backgroundColor: '#10B98114', borderColor: '#10B98144' }]}>
            <View style={styles.virusFreeIconWrap}>
              <Ionicons name="shield-checkmark" size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.virusFreeBannerTitle}>
                100% Virus-Free, Clean & Verified Build
              </Text>
              <Text style={[styles.virusFreeBannerDesc, { color: colors.textSecondary }]}>
                Compiled directly on Expo Cloud Infrastructure. Yomite is 100% open source, ad-free, and contains zero malware, viruses, or intrusive background trackers. Sideload safely with total peace of mind.
              </Text>
            </View>
          </View>

          {/* OS Switcher Tabs */}
          <View style={styles.guideTabsRow}>
            <Pressable
              onPress={() => {
                triggerHaptic();
                setActiveGuideTab('android');
              }}
              style={[
                styles.guideTabBtn,
                {
                  backgroundColor: activeGuideTab === 'android' ? colors.accent : colors.surfaceElevated,
                },
              ]}
            >
              <Ionicons name="logo-android" size={16} color={activeGuideTab === 'android' ? '#FFF' : colors.textSecondary} />
              <Text style={[styles.guideTabBtnText, { color: activeGuideTab === 'android' ? '#FFF' : colors.textSecondary }]}>
                Android Sideload (APK)
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                triggerHaptic();
                setActiveGuideTab('ios');
              }}
              style={[
                styles.guideTabBtn,
                {
                  backgroundColor: activeGuideTab === 'ios' ? colors.accent : colors.surfaceElevated,
                },
              ]}
            >
              <Ionicons name="logo-apple" size={16} color={activeGuideTab === 'ios' ? '#FFF' : colors.textSecondary} />
              <Text style={[styles.guideTabBtnText, { color: activeGuideTab === 'ios' ? '#FFF' : colors.textSecondary }]}>
                iPhone / iPad (PWA)
              </Text>
            </Pressable>
          </View>

          {/* Guide Steps */}
          {activeGuideTab === 'android' ? (
            <View style={styles.stepsContainer}>
              <View style={[styles.stepCard, { borderColor: colors.borderSubtle }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.stepNumberText, { color: colors.accent }]}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepCardTitle, { color: colors.text }]}>Open the Download Link</Text>
                  <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
                    Click <Text style={{ fontWeight: 'bold', color: colors.text }}>"Download Direct APK"</Text> or scan the QR code above to open the official Yomite build page on Expo.
                  </Text>
                </View>
              </View>

              <View style={[styles.stepCard, { borderColor: colors.borderSubtle }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.stepNumberText, { color: colors.accent }]}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepCardTitle, { color: colors.text }]}>Click "Install" on Expo</Text>
                  <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
                    On the Expo project build page, tap the blue <Text style={{ fontWeight: 'bold', color: colors.text }}>"Install"</Text> button. Your browser will start downloading the compiled APK file.
                  </Text>
                </View>
              </View>

              <View style={[styles.stepCard, { borderColor: colors.borderSubtle }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.stepNumberText, { color: colors.accent }]}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepCardTitle, { color: colors.text }]}>Check Chrome / Browser Downloads</Text>
                  <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
                    Open your browser downloads list (in Chrome, tap <Text style={{ fontWeight: 'bold', color: colors.text }}>⋮ Menu → Downloads</Text>). Look for the downloaded file named <Text style={{ fontWeight: 'bold', color: colors.accent }}>application-....apk</Text>.
                  </Text>
                </View>
              </View>

              <View style={[styles.stepCard, { borderColor: colors.borderSubtle }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.stepNumberText, { color: colors.accent }]}>4</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepCardTitle, { color: colors.text }]}>Install & Launch Yomite</Text>
                  <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
                    Tap the <Text style={{ fontWeight: 'bold', color: colors.text }}>application-....apk</Text> file and press <Text style={{ fontWeight: 'bold', color: colors.text }}>Install</Text>. (If prompted by Android, enable <Text style={{ fontWeight: 'bold', color: colors.text }}>"Allow from this source"</Text>). Open Yomite and enjoy your manga offline!
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.stepsContainer}>
              <View style={[styles.stepCard, { borderColor: colors.borderSubtle }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.stepNumberText, { color: colors.accent }]}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepCardTitle, { color: colors.text }]}>Open in Mobile Safari</Text>
                  <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
                    Navigate to <Text style={{ fontWeight: 'bold' }}>Yomite</Text> on your iPhone or iPad using the Safari browser.
                  </Text>
                </View>
              </View>

              <View style={[styles.stepCard, { borderColor: colors.borderSubtle }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.stepNumberText, { color: colors.accent }]}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepCardTitle, { color: colors.text }]}>Tap the Share Icon</Text>
                  <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
                    Tap the Safari Share button (the square with an arrow pointing upward at the bottom of the screen).
                  </Text>
                </View>
              </View>

              <View style={[styles.stepCard, { borderColor: colors.borderSubtle }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.stepNumberText, { color: colors.accent }]}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepCardTitle, { color: colors.text }]}>Select "Add to Home Screen"</Text>
                  <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
                    Scroll down and tap <Text style={{ fontWeight: 'bold' }}>Add to Home Screen</Text>. Yomite will install as a native fullscreen app on your home screen.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* FOOTER */}
        <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
          <View style={styles.footerBrand}>
            <Image source={require('../assets/images/mascot.png')} style={styles.footerMascot} contentFit="cover" />
            <Text style={[styles.footerBrandText, { color: colors.text }]}>Yomite Manga Reader</Text>
          </View>
          <Text style={[styles.footerCopy, { color: colors.textMuted }]}>
            Powered by MangaDex API. Built with Expo & React Native.
          </Text>
          <View style={styles.footerLinks}>
            <Pressable onPress={() => router.push('/(tabs)' as any)}>
              <Text style={[styles.footerLinkText, { color: colors.accent }]}>Discover</Text>
            </Pressable>
            <Text style={{ color: colors.border }}>•</Text>
            <Pressable onPress={() => router.push('/(tabs)/community' as any)}>
              <Text style={[styles.footerLinkText, { color: colors.accent }]}>Community</Text>
            </Pressable>
            <Text style={{ color: colors.border }}>•</Text>
            <Pressable onPress={() => router.push('/(tabs)/settings' as any)}>
              <Text style={[styles.footerLinkText, { color: colors.accent }]}>Settings</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing['4xl'],
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoMascot: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  logoText: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.5,
  },
  versionPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  versionPillText: {
    fontSize: 9,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  navLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  navLinkText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  navPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.md,
  },
  navPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },

  /* Unified Hero Section (Desktop: 2-Columns / Mobile: Stacked) */
  unifiedHeroSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.lg,
    position: 'relative',
  },
  unifiedHeroDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 850,
    paddingTop: Spacing['3xl'],
    paddingBottom: 90,
    gap: Spacing['3xl'],
    marginBottom: 80,
  },
  heroLeftCol: {
    flex: 1.2,
    maxWidth: 660,
  },
  heroLeftColDesktop: {
    paddingRight: Spacing.sm,
  },
  heroRightCol: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minWidth: 330,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  liveReleaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveReleaseBadgeText: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.6,
  },
  osTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  osTagText: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
  },
  heroHeadline: {
    fontSize: Platform.OS === 'web' ? 56 : 34,
    fontWeight: Typography.weights.bold,
    lineHeight: Platform.OS === 'web' ? 62 : 40,
    letterSpacing: -1.4,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  heroSubheadline: {
    fontSize: Platform.OS === 'web' ? 18.5 : 15,
    lineHeight: Platform.OS === 'web' ? 29 : 22,
    maxWidth: 620,
    marginBottom: Spacing.lg,
  },
  heroCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  primaryDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: Radius.lg,
    gap: 12,
    boxShadow: '0 6px 14px rgba(244, 63, 94, 0.35)',
    elevation: 8,
  },
  primaryDownloadIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryDownloadCol: {
    gap: 2,
  },
  primaryDownloadLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: Typography.weights.bold,
  },
  primaryDownloadMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: Typography.weights.medium,
  },
  secondaryQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  secondaryQrBtnText: {
    fontSize: 15,
    fontWeight: Typography.weights.semibold,
  },
  heroSlideSelector: {
    gap: 6,
    marginTop: 2,
  },
  heroSlideSelectorLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.2,
  },
  heroTrustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  heroTrustCard: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  heroTrustIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTrustContent: {
    flex: 1,
    gap: 2,
  },
  heroTrustTitle: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
  },
  heroTrustSub: {
    fontSize: 10,
    lineHeight: 13,
  },
  heroArchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.sm,
  },
  heroArchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  heroArchText: {
    fontSize: 11,
    fontWeight: Typography.weights.medium,
  },
  ambientGlow: {
    position: 'absolute',
    top: '10%',
    alignSelf: 'center',
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: 'rgba(244,63,94,0.18)',
    opacity: 0.9,
    transform: [{ scale: 1.3 }],
    pointerEvents: 'none',
  },
  heroScrollDownBtn: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: [{ translateX: -70 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.25)',
    elevation: 4,
    zIndex: 20,
  },
  heroScrollDownText: {
    fontSize: 11,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.4,
  },
  floatingDeviceToggleWrap: {
    alignItems: 'center',
    marginBottom: Spacing.xs,
    zIndex: 15,
  },
  floatingDeviceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.25)',
    elevation: 4,
  },
  deviceTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deviceTogglePillText: {
    fontSize: 12.5,
    fontWeight: Typography.weights.bold,
  },

  /* 3D Stacked Carousel Stage */
  phoneCarouselStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 320,
    height: 610,
  },
  phoneCarouselStageDesktop: {
    width: 520,
    height: 620,
  },

  /* 3D Stacked Phone Shells */
  standalonePhoneShell: {
    width: 290,
    height: 580,
    backgroundColor: '#09090B',
    borderColor: '#27272A',
    borderWidth: 7,
    borderRadius: 48,
    position: 'absolute',
    overflow: 'hidden',
    boxShadow: '0 18px 30px rgba(0, 0, 0, 0.55)',
    elevation: 20,
  },
  iphoneShell: {
    borderRadius: 48,
    borderColor: '#27272A',
  },
  androidShell: {
    borderRadius: 36,
    borderColor: '#3F3F46',
  },
  stackedPhoneDimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 30,
    borderRadius: 44,
    zIndex: 15,
  },
  stackedPhoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
    elevation: 6,
  },
  stackedPhoneBadgeText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.3,
  },

  /* Notch & Dynamic Island */
  dynamicIsland: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: 96,
    height: 25,
    backgroundColor: '#000000',
    borderRadius: 14,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 10,
  },
  dynamicIslandSensor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#18181B',
    marginRight: 6,
  },
  dynamicIslandCamera: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#1E1B4B',
  },
  androidCameraPunch: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000000',
    zIndex: 20,
  },

  /* Status Bar */
  mockupStatusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 12,
    height: 38,
    zIndex: 15,
    pointerEvents: 'none',
  },
  mockupStatusTime: {
    color: '#FAFAFA',
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
  mockupStatusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mockupScreenInner: {
    flex: 1,
    backgroundColor: '#0D0D10',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  mockScreenImageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0D0D10',
    overflow: 'hidden',
  },
  mockScreenImage: {
    width: '100%',
    height: '100%',
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    width: 110,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#71717A',
    zIndex: 20,
  },

  /* 1. Mock Screen: Reader */
  mockScreenReader: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mockReaderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#27272A',
  },
  mockReaderTitle: {
    color: '#FAFAFA',
    fontSize: 12,
    fontWeight: Typography.weights.bold,
  },
  mockReaderSubTitle: {
    color: '#A1A1AA',
    fontSize: 9,
  },
  mockReaderArtStrip: {
    flex: 1,
    marginVertical: 8,
    gap: 8,
    justifyContent: 'center',
  },
  mockMangaPanelTop: {
    flex: 1.2,
    backgroundColor: '#1C1C20',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2E2E35',
  },
  mockActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244,63,94,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  mockActionBadgeText: {
    color: '#F43F5E',
    fontSize: 9,
    fontWeight: Typography.weights.bold,
  },
  mockPanelLines: {
    gap: 4,
  },
  mockPanelLine: {
    height: 6,
    backgroundColor: '#27272A',
    borderRadius: 3,
  },
  mockMangaPanelBottom: {
    flex: 1,
    backgroundColor: '#232328',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2E2E35',
  },
  mockDialogueBubble: {
    backgroundColor: '#121215',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  mockDialogueText: {
    color: '#FAFAFA',
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 14,
  },
  mockGesturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
  },
  mockGesturePillText: {
    color: '#A1A1AA',
    fontSize: 9,
  },
  mockReaderFooter: {
    gap: 6,
    paddingTop: 4,
  },
  mockReaderFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mockReaderFooterPage: {
    color: '#FAFAFA',
    fontSize: 10,
    fontWeight: Typography.weights.semibold,
  },
  mockPillBadge: {
    backgroundColor: '#27272A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mockPillBadgeText: {
    color: '#A1A1AA',
    fontSize: 9,
    fontWeight: Typography.weights.bold,
  },
  mockReaderProgress: {
    height: 3,
    backgroundColor: '#27272A',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  mockReaderProgressBar: {
    height: '100%',
    backgroundColor: '#F43F5E',
  },

  /* 2. Mock Screen: Offline Vault */
  mockScreenOffline: {
    flex: 1,
  },
  mockScreenHeaderSimple: {
    marginBottom: 8,
  },
  mockScreenHeading: {
    color: '#FAFAFA',
    fontSize: 14,
    fontWeight: Typography.weights.bold,
  },
  mockScreenSub: {
    color: '#A1A1AA',
    fontSize: 10,
    marginTop: 2,
  },
  mockStorageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mockStorageBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  mockDownloadCard: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1C1C20',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  mockDownloadCardActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  mockDownloadCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  mockActivePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  mockDownloadCardTitle: {
    color: '#FAFAFA',
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    flex: 1,
  },
  mockDownloadPercent: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  mockDownloadCardSub: {
    color: '#A1A1AA',
    fontSize: 9,
    marginBottom: 4,
  },
  mockDownloadProgressBar: {
    height: 3,
    backgroundColor: '#27272A',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  mockDownloadProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  mockDownloadPauseBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockDownloadCardSize: {
    color: '#71717A',
    fontSize: 9,
    fontWeight: Typography.weights.semibold,
  },

  /* 3. Mock Screen: Languages */
  mockScreenLanguages: {
    flex: 1,
  },
  mockLangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1C1C20',
    marginBottom: 5,
    gap: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  mockLangFlag: {
    width: 18,
    height: 13,
    borderRadius: 2,
  },
  mockLangName: {
    color: '#FAFAFA',
    fontSize: 11,
  },
  mockLangCount: {
    color: '#71717A',
    fontSize: 8,
  },
  mockLangCode: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#27272A',
  },
  mockLangCodeText: {
    color: '#A1A1AA',
    fontSize: 8,
    fontWeight: Typography.weights.bold,
  },

  /* 4. Mock Screen: Library */
  mockScreenLibrary: {
    flex: 1,
  },
  mockSyncBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  mockSyncGreenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  mockSyncBadgePillText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: Typography.weights.bold,
  },
  mockCategoryPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  mockCatPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#1C1C20',
  },
  mockCatPillActive: {
    backgroundColor: '#F43F5E',
  },
  mockCatPillText: {
    color: '#A1A1AA',
    fontSize: 9,
  },
  mockCatPillActiveText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: Typography.weights.bold,
  },
  mockLibraryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  mockLibraryCard: {
    width: '31%',
    gap: 2,
  },
  mockLibraryCardCover: {
    aspectRatio: 0.72,
    backgroundColor: '#1C1C20',
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mockUnreadBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  mockUnreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: Typography.weights.bold,
  },
  mockLibraryCardTitle: {
    color: '#FAFAFA',
    fontSize: 9,
    fontWeight: Typography.weights.semibold,
  },
  mockLibraryCardProgress: {
    color: '#71717A',
    fontSize: 8,
  },

  /* Slide Switcher Segmented Bottom Bar */
  slideSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 4,
    zIndex: 15,
  },
  slideIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  slideDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  slideNumberText: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
  },
  slideTitleText: {
    fontSize: 13.5,
    fontWeight: Typography.weights.semibold,
  },

  /* Feature Grid (Bento 2x2 Showcase) */
  featuresSection: {
    maxWidth: 1160,
    alignSelf: 'center',
    width: '92%',
    marginTop: 80,
    paddingTop: Spacing['3xl'],
    marginBottom: Spacing['4xl'],
  },
  featuresHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  featuresPretitle: {
    fontSize: 13,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  featuresTitle: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.5,
  },
  bentoMatrixBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  bentoMatrixBadgeText: {
    fontSize: 12.5,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  pulseDotGreen: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  featureGrid: {
    gap: Spacing.xl,
  },
  featureGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl + 4,
    gap: Spacing.sm + 2,
    width: '100%',
  },
  featureCardDesktop: {
    width: '48.8%',
  },
  featureCardHovered: {
    borderColor: 'rgba(255, 255, 255, 0.24)',
    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.35)',
    elevation: 6,
  },
  featureCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureMetricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  featureMetricPillText: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.4,
  },
  featureCardTitle: {
    fontSize: 21,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.2,
  },
  featureCardDesc: {
    fontSize: 15.5,
    lineHeight: 23,
    marginBottom: Spacing.xs,
  },

  /* Mini Widget Boxes */
  miniWidgetBox: {
    marginTop: Spacing.sm,
    padding: Spacing.md + 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.sm + 2,
  },
  miniWidgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniWidgetLabel: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  miniWidgetStatus: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.6,
  },
  miniModeSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  miniModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  miniModePillText: {
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
  },
  fpsSimCanvas: {
    gap: 8,
    marginTop: 4,
  },
  fpsSimBarGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 24,
  },
  fpsSimBar: {
    flex: 1,
    borderRadius: 2,
  },
  fpsSimNote: {
    fontSize: 12.5,
    lineHeight: 18,
  },

  miniVaultPauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  miniVaultPauseText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },

  /* Vault Widget */
  vaultProgressBox: {
    gap: 6,
  },
  vaultMangaTitle: {
    fontSize: 14.5,
    fontWeight: Typography.weights.bold,
    flex: 1,
  },
  vaultPercentText: {
    fontSize: 14.5,
    fontWeight: Typography.weights.bold,
  },
  vaultChapterSub: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  vaultProgressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  vaultProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  vaultTagsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  vaultTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  vaultTagPillText: {
    fontSize: 12,
    fontWeight: Typography.weights.medium,
  },

  /* Languages Widget */
  miniLangGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniLangPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  miniLangFlag: {
    fontSize: 14,
  },
  miniLangFlagImg: {
    width: 20,
    height: 14,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  miniLangText: {
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
  },
  miniLangFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  miniLangFooterText: {
    fontSize: 12.5,
  },

  /* Cloud Sync Widget */
  syncTopologyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
  },
  syncDeviceBox: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 3,
  },
  syncDeviceName: {
    fontSize: 13.5,
    fontWeight: Typography.weights.bold,
  },
  syncDeviceSub: {
    fontSize: 11.5,
    fontWeight: Typography.weights.semibold,
  },
  syncConnectorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 70,
  },
  syncConnectorLine: {
    position: 'absolute',
    height: 1.5,
    left: 0,
    right: 0,
    top: '50%',
    opacity: 0.4,
  },
  syncPulsePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    zIndex: 2,
  },
  syncPulseText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    color: '#F59E0B',
  },
  syncItemPillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  syncItemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  syncItemPillText: {
    fontSize: 12.5,
    fontWeight: Typography.weights.medium,
  },

  /* Specs Section */
  specsSection: {
    maxWidth: 1100,
    alignSelf: 'center',
    width: '92%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl + 4,
    marginBottom: Spacing['3xl'],
  },
  specsGrid: {
    gap: Spacing['2xl'],
  },
  specsGridDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  specsColLeft: {
    flex: 1.3,
  },
  releaseHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  releaseHeaderBadgeText: {
    fontSize: 13,
    fontWeight: Typography.weights.bold,
  },
  specsTitle: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  specsSubtitle: {
    fontSize: 17,
    lineHeight: 25,
    marginBottom: Spacing.lg,
  },
  specsTable: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  specsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  specsTableLabel: {
    fontSize: 15.5,
  },
  specsTableValue: {
    fontSize: 15.5,
    fontWeight: Typography.weights.semibold,
  },
  shaCard: {
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: 8,
  },
  shaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shaLabel: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  shaCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  shaCopyBtnText: {
    fontSize: 13,
    fontWeight: Typography.weights.bold,
  },
  shaValue: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.2,
  },
  directDownloadBtnBig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: Radius.lg,
  },
  directDownloadBtnBigText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: Typography.weights.bold,
  },

  specsColRight: {
    flex: 1,
    padding: Spacing.xl + 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrTitle: {
    fontSize: 21,
    fontWeight: Typography.weights.bold,
    marginBottom: 6,
  },
  qrSub: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  qrCodeFrame: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.25)',
    elevation: 6,
    marginBottom: Spacing.md,
  },
  qrImage: {
    width: 190,
    height: 190,
  },
  qrInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qrInfoBadgeText: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
  },

  /* Guide Section */
  guideSection: {
    maxWidth: 1100,
    alignSelf: 'center',
    width: '92%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl + 4,
    marginBottom: Spacing['3xl'],
  },
  guidePretitle: {
    fontSize: 13,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  guideTitle: {
    fontSize: 28,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.md,
    letterSpacing: -0.4,
  },
  virusFreeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md + 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  virusFreeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B98120',
    justifyContent: 'center',
    alignItems: 'center',
  },
  virusFreeBannerTitle: {
    color: '#10B981',
    fontSize: 18.5,
    fontWeight: Typography.weights.bold,
  },
  virusFreeBannerDesc: {
    fontSize: 15.5,
    lineHeight: 22,
  },
  guideTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  guideTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  guideTabBtnText: {
    fontSize: 15,
    fontWeight: Typography.weights.bold,
  },
  stepsContainer: {
    gap: Spacing.lg,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md + 2,
    paddingVertical: Spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 19,
    fontWeight: Typography.weights.bold,
  },
  stepCardTitle: {
    fontSize: 19,
    fontWeight: Typography.weights.bold,
    marginBottom: 4,
  },
  stepCardDesc: {
    fontSize: 15.5,
    lineHeight: 23,
  },

  /* Footer */
  footer: {
    maxWidth: 1100,
    alignSelf: 'center',
    width: '92%',
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing['3xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: Spacing.md,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerMascot: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  footerBrandText: {
    fontSize: 18,
    fontWeight: Typography.weights.bold,
  },
  footerCopy: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginTop: 6,
  },
  footerLinkText: {
    fontSize: 15,
    fontWeight: Typography.weights.semibold,
  },
});
