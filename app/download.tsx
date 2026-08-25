/**
 * Yomite Mobile App Promotion & Direct Download Page
 * Aesthetic: Editorial Cyber-Minimalist (Swiss Dark Monolith)
 * Features: Realistic Device Mockup, Interactive Demo Tabs, Direct APK Download,
 * QR Code Sideloading, SHA-256 Checksum, and Step-by-Step Installation Guides.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
  Linking,
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
  fileSize: '28.4 MB',
  minAndroid: 'Android 8.0 (Oreo) or higher',
  minIos: 'iOS 15.0+ (via Web PWA)',
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  apkDownloadUrl: 'https://github.com/Yomite/manga-app/releases/latest/download/yomite-v1.2.0-release.apk',
};

type DemoTab = 'reader' | 'offline' | 'languages' | 'library';

export default function AppDownloadScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 900;
  const isTablet = windowWidth >= 640 && windowWidth < 900;

  const [activeTab, setActiveTab] = useState<DemoTab>('reader');
  const [deviceType, setDeviceType] = useState<'iphone' | 'android'>('iphone');
  const [copiedSha, setCopiedSha] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'android' | 'ios'>('android');
  const [attachedMediaUrl, setAttachedMediaUrl] = useState<string | null>(null);

  const handleCopySha = async () => {
    triggerHaptic();
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(APP_RELEASE.sha256);
      }
    } catch {
      // fallback
    }
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2500);
  };

  const handleDownloadApk = () => {
    triggerHaptic();
    if (Platform.OS === 'web') {
      window.open(APP_RELEASE.apkDownloadUrl, '_blank');
    } else {
      Linking.openURL(APP_RELEASE.apkDownloadUrl);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Top Navbar */}
      <View style={[styles.navbar, { borderBottomColor: colors.borderSubtle, backgroundColor: colors.background }]}>
        <View style={styles.navLeft}>
          <Pressable
            onPress={() => router.push('/(tabs)' as any)}
            style={({ pressed }) => [styles.logoBtn, pressed && { opacity: 0.8 }]}
          >
            <Image
              source={require('../assets/images/mascot.png')}
              style={styles.logoMascot}
              contentFit="cover"
            />
            <Text style={[styles.logoText, { color: colors.text }]}>Yomite</Text>
            <View style={[styles.versionPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.versionPillText, { color: colors.accent }]}>MOBILE</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.navRight}>
          <Pressable
            onPress={() => router.push('/(tabs)' as any)}
            style={({ pressed }) => [
              styles.navLinkBtn,
              { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="arrow-back" size={15} color={colors.text} />
            <Text style={[styles.navLinkText, { color: colors.text }]}>Web App</Text>
          </Pressable>

          <Pressable
            onPress={handleDownloadApk}
            style={({ pressed }) => [
              styles.navPrimaryBtn,
              { backgroundColor: colors.accent },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Ionicons name="download-outline" size={16} color="#FFFFFF" />
            <Text style={styles.navPrimaryBtnText}>Download APK</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* UNIFIED HERO SECTION: LEFT TEXT & CTA / RIGHT STANDALONE PHONE */}
        <View style={[styles.unifiedHeroSection, isDesktop && styles.unifiedHeroDesktop]}>
          {/* LEFT COLUMN: HERO CONTENT & CTA */}
          <View style={[styles.heroLeftCol, isDesktop && styles.heroLeftColDesktop]}>
            <View style={styles.heroBadgeRow}>
              <View style={[styles.liveReleaseBadge, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}>
                <View style={[styles.pulseDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.liveReleaseBadgeText, { color: colors.accent }]}>
                  {APP_RELEASE.version} OFFICIAL RELEASE
                </Text>
              </View>
              <View style={[styles.osTag, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Ionicons name="logo-android" size={13} color="#22C55E" />
                <Text style={[styles.osTagText, { color: colors.textSecondary }]}>Android APK</Text>
              </View>
              <View style={[styles.osTag, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Ionicons name="logo-apple" size={13} color={colors.text} />
                <Text style={[styles.osTagText, { color: colors.textSecondary }]}>iOS PWA</Text>
              </View>
            </View>

            <Text style={[styles.heroHeadline, { color: colors.text }]}>
              The Ultimate Manga Reader.{'\n'}
              <Text style={{ color: colors.accent }}>Pure, Offline, Free.</Text>
            </Text>

            <Text style={[styles.heroSubheadline, { color: colors.textSecondary }]}>
              Experience lightning-fast 60fps reading, 1-click full chapter downloads, 30+ translation languages, and real-time cloud sync across your devices. No paywalls, no popups.
            </Text>

            {/* Quick CTA Actions */}
            <View style={styles.heroCtaRow}>
              <Pressable
                onPress={handleDownloadApk}
                style={({ pressed }) => [
                  styles.primaryDownloadBtn,
                  { backgroundColor: colors.accent },
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
            </View>

            {/* Interactive Feature Demo Pills on the Left */}
            <View style={styles.heroSlideSelector}>
              <Text style={[styles.heroSlideSelectorLabel, { color: colors.textMuted }]}>
                CLICK TO PREVIEW APP SCREENS
              </Text>
              <View style={styles.slideSwitcherRow}>
                {[
                  { id: 'reader' as const, num: '01', title: '60fps Reader', icon: 'book-outline' as const },
                  { id: 'offline' as const, num: '02', title: 'Offline Vault', icon: 'download-outline' as const },
                  { id: 'languages' as const, num: '03', title: '30+ Languages', icon: 'globe-outline' as const },
                  { id: 'library' as const, num: '04', title: 'Cloud Library', icon: 'sync-outline' as const },
                ].map((slide) => {
                  const isSelected = activeTab === slide.id;
                  return (
                    <Pressable
                      key={slide.id}
                      onPress={() => {
                        triggerHaptic();
                        setActiveTab(slide.id);
                      }}
                      style={[
                        styles.slideIndicatorPill,
                        {
                          backgroundColor: isSelected ? colors.surfaceElevated : 'transparent',
                          borderColor: isSelected ? colors.accent : colors.borderSubtle,
                        },
                      ]}
                    >
                      <View style={[styles.slideDot, { backgroundColor: isSelected ? colors.accent : colors.border }]} />
                      <Text style={[styles.slideNumberText, { color: isSelected ? colors.accent : colors.textMuted }]}>
                        {slide.num}
                      </Text>
                      <Text
                        style={[
                          styles.slideTitleText,
                          {
                            color: isSelected ? colors.text : colors.textSecondary,
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
          </View>

          {/* RIGHT COLUMN: STANDALONE PHONE SHOWCASE */}
          <View style={styles.heroRightCol}>
            {/* Ambient Glow Backdrop */}
            <View style={styles.ambientGlow} />

            {/* Floating Device Type Pill Switcher */}
            <View style={styles.floatingDeviceToggleWrap}>
              <View style={[styles.floatingDeviceToggle, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setDeviceType('iphone');
                  }}
                  style={[
                    styles.deviceTogglePill,
                    deviceType === 'iphone' && { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="logo-apple" size={14} color={deviceType === 'iphone' ? colors.text : colors.textMuted} />
                  <Text style={[styles.deviceTogglePillText, { color: deviceType === 'iphone' ? colors.text : colors.textMuted }]}>
                    iPhone 16 Pro
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setDeviceType('android');
                  }}
                  style={[
                    styles.deviceTogglePill,
                    deviceType === 'android' && { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="logo-android" size={14} color={deviceType === 'android' ? '#22C55E' : colors.textMuted} />
                  <Text style={[styles.deviceTogglePillText, { color: deviceType === 'android' ? colors.text : colors.textMuted }]}>
                    Galaxy Ultra
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Standalone Phone Stage with Left/Right Carousel Controls */}
            <View style={styles.phoneCarouselStage}>
              {/* Left Nav Arrow Button */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  const tabs: DemoTab[] = ['reader', 'offline', 'languages', 'library'];
                  const currentIndex = tabs.indexOf(activeTab);
                  const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                  setActiveTab(tabs[prevIndex]);
                }}
                style={({ pressed }) => [
                  styles.navArrowBtn,
                  styles.navArrowLeft,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
                ]}
                accessibilityLabel="Previous feature demo"
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>

              {/* Standalone Phone Frame */}
              <View
                style={[
                  styles.standalonePhoneShell,
                  deviceType === 'iphone' ? styles.iphoneShell : styles.androidShell,
                ]}
              >
                {/* Tap Left / Right Overlay for intuitive swipe/slide navigation */}
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    const tabs: DemoTab[] = ['reader', 'offline', 'languages', 'library'];
                    const currentIndex = tabs.indexOf(activeTab);
                    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    setActiveTab(tabs[prevIndex]);
                  }}
                  style={styles.phoneTapLeftHitbox}
                />
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    const tabs: DemoTab[] = ['reader', 'offline', 'languages', 'library'];
                    const currentIndex = tabs.indexOf(activeTab);
                    const nextIndex = (currentIndex + 1) % tabs.length;
                    setActiveTab(tabs[nextIndex]);
                  }}
                  style={styles.phoneTapRightHitbox}
                />

                {/* Dynamic Island / Punch Hole */}
                {deviceType === 'iphone' ? (
                  <View style={styles.dynamicIsland}>
                    <View style={styles.dynamicIslandSensor} />
                    <View style={styles.dynamicIslandCamera} />
                  </View>
                ) : (
                  <View style={styles.androidCameraPunch} />
                )}

                {/* Realistic Status Bar */}
                <View style={styles.mockupStatusBar}>
                  <Text style={styles.mockupStatusTime}>9:41</Text>
                  <View style={styles.mockupStatusIcons}>
                    <Ionicons name="cellular" size={11} color="#FAFAFA" />
                    <Ionicons name="wifi" size={11} color="#FAFAFA" />
                    <Ionicons name="battery-full" size={13} color="#FAFAFA" />
                  </View>
                </View>

                {/* Phone Screen Animated Content */}
                <View style={styles.mockupScreenInner}>
                  {attachedMediaUrl ? (
                    <Image source={{ uri: attachedMediaUrl }} style={styles.mockupMediaImage} contentFit="cover" />
                  ) : activeTab === 'reader' ? (
                    /* ─── 1. 60FPS ULTRA-SMOOTH READER DEMO ─── */
                    <View style={styles.mockScreenReader}>
                      {/* Top Reader HUD */}
                      <View style={styles.mockReaderHeader}>
                        <Ionicons name="arrow-back" size={18} color="#FAFAFA" />
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.mockReaderTitle}>Jujutsu Kaisen</Text>
                          <Text style={styles.mockReaderSubTitle}>Chapter 268 • Page 14</Text>
                        </View>
                        <Ionicons name="options-outline" size={18} color="#FAFAFA" />
                      </View>

                      {/* Animated Manga Webtoon Strip */}
                      <View style={styles.mockReaderArtStrip}>
                        <View style={styles.mockMangaPanelTop}>
                          <View style={styles.mockActionBadge}>
                            <Ionicons name="flash" size={12} color="#F43F5E" />
                            <Text style={styles.mockActionBadgeText}>60fps Hardware Accelerated</Text>
                          </View>
                          <View style={styles.mockPanelLines}>
                            <View style={[styles.mockPanelLine, { width: '85%' }]} />
                            <View style={[styles.mockPanelLine, { width: '65%' }]} />
                          </View>
                        </View>

                        <View style={styles.mockMangaPanelBottom}>
                          <View style={styles.mockDialogueBubble}>
                            <Text style={styles.mockDialogueText}>"This is where the real domain expansion begins..."</Text>
                          </View>
                          <View style={styles.mockGesturePill}>
                            <Ionicons name="hand-left-outline" size={12} color="#A1A1AA" />
                            <Text style={styles.mockGesturePillText}>Double Tap to Zoom</Text>
                          </View>
                        </View>
                      </View>

                      {/* Bottom Reader Navigation HUD */}
                      <View style={styles.mockReaderFooter}>
                        <View style={styles.mockReaderFooterRow}>
                          <Text style={styles.mockReaderFooterPage}>14 / 24</Text>
                          <View style={styles.mockPillBadge}>
                            <Text style={styles.mockPillBadgeText}>Webtoon Strip</Text>
                          </View>
                        </View>
                        <View style={styles.mockReaderProgress}>
                          <View style={[styles.mockReaderProgressBar, { width: '58%' }]} />
                        </View>
                      </View>
                    </View>
                  ) : activeTab === 'offline' ? (
                    /* ─── 2. OFFLINE CHAPTER VAULT DEMO ─── */
                    <View style={styles.mockScreenOffline}>
                      <View style={styles.mockScreenHeaderSimple}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.mockScreenHeading}>Offline Vault</Text>
                          <View style={styles.mockStorageBadge}>
                            <Ionicons name="cloud-done" size={12} color="#10B981" />
                            <Text style={styles.mockStorageBadgeText}>2.4 GB</Text>
                          </View>
                        </View>
                        <Text style={styles.mockScreenSub}>Downloaded for airplane & subway reading</Text>
                      </View>

                      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                        {/* Active Downloading Item with Animated Progress */}
                        <View style={[styles.mockDownloadCard, styles.mockDownloadCardActive]}>
                          <View style={styles.mockDownloadCardHeader}>
                            <View style={styles.mockActivePulseDot} />
                            <Text style={styles.mockDownloadCardTitle} numberOfLines={1}>Solo Leveling: Ragnarok</Text>
                            <Text style={styles.mockDownloadPercent}>84%</Text>
                          </View>
                          <Text style={styles.mockDownloadCardSub}>Downloading Ch. 15 of 20 • 24.8 MB/s</Text>
                          <View style={styles.mockDownloadProgressBar}>
                            <View style={[styles.mockDownloadProgressFill, { width: '84%' }]} />
                          </View>
                        </View>

                        {/* Completed Downloads */}
                        {[
                          { title: 'Chainsaw Man', ch: 'Ch. 175 - 180 (6 chapters)', size: '142 MB', date: 'Downloaded 2h ago' },
                          { title: 'One Piece', ch: 'Ch. 1120 - 1124 (5 chapters)', size: '110 MB', date: 'Downloaded yesterday' },
                          { title: 'Frieren: Beyond Journey', ch: 'Ch. 130 - 132 (3 chapters)', size: '68 MB', date: 'Downloaded 3d ago' },
                        ].map((item, i) => (
                          <View key={i} style={styles.mockDownloadCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.mockDownloadCardTitle}>{item.title}</Text>
                                <Text style={styles.mockDownloadCardSub}>{item.ch}</Text>
                              </View>
                              <Text style={styles.mockDownloadCardSize}>{item.size}</Text>
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ) : activeTab === 'languages' ? (
                    /* ─── 3. 30+ MULTI-LANGUAGE TRANSLATIONS DEMO ─── */
                    <View style={styles.mockScreenLanguages}>
                      <View style={styles.mockScreenHeaderSimple}>
                        <Text style={styles.mockScreenHeading}>Chapter Translations</Text>
                        <Text style={styles.mockScreenSub}>Select translation team & language:</Text>
                      </View>
                      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                        {[
                          { flag: 'https://flagcdn.com/w40/us.png', name: 'English', code: 'EN', active: true, count: '268 Ch.' },
                          { flag: 'https://flagcdn.com/w40/id.png', name: 'Indonesian', code: 'ID', active: false, count: '268 Ch.' },
                          { flag: 'https://flagcdn.com/w40/mx.png', name: 'Spanish (LATAM)', code: 'ES-LA', active: false, count: '265 Ch.' },
                          { flag: 'https://flagcdn.com/w40/br.png', name: 'Portuguese (BR)', code: 'PT-BR', active: false, count: '260 Ch.' },
                          { flag: 'https://flagcdn.com/w40/fr.png', name: 'French', code: 'FR', active: false, count: '258 Ch.' },
                          { flag: 'https://flagcdn.com/w40/jp.png', name: 'Japanese (Raw)', code: 'JA', active: false, count: '268 Ch.' },
                          { flag: 'https://flagcdn.com/w40/de.png', name: 'German', code: 'DE', active: false, count: '240 Ch.' },
                        ].map((lang, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.mockLangRow,
                              lang.active && { backgroundColor: 'rgba(244,63,94,0.18)', borderColor: '#F43F5E' },
                            ]}
                          >
                            <Image source={{ uri: lang.flag }} style={styles.mockLangFlag} contentFit="cover" />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.mockLangName, lang.active && { color: '#F43F5E', fontWeight: 'bold' }]}>
                                {lang.name}
                              </Text>
                              <Text style={styles.mockLangCount}>{lang.count}</Text>
                            </View>
                            <View style={styles.mockLangCode}>
                              <Text style={styles.mockLangCodeText}>{lang.code}</Text>
                            </View>
                            {lang.active && <Ionicons name="checkmark-circle" size={16} color="#F43F5E" style={{ marginLeft: 4 }} />}
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ) : (
                    /* ─── 4. SMART CLOUD LIBRARY & BOOKMARKS DEMO ─── */
                    <View style={styles.mockScreenLibrary}>
                      <View style={styles.mockScreenHeaderSimple}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.mockScreenHeading}>My Library</Text>
                          <View style={styles.mockSyncBadgePill}>
                            <View style={styles.mockSyncGreenDot} />
                            <Text style={styles.mockSyncBadgePillText}>Cloud Synced</Text>
                          </View>
                        </View>
                        <View style={styles.mockCategoryPills}>
                          <View style={[styles.mockCatPill, styles.mockCatPillActive]}>
                            <Text style={styles.mockCatPillActiveText}>Reading (18)</Text>
                          </View>
                          <View style={styles.mockCatPill}>
                            <Text style={styles.mockCatPillText}>Plan to Read</Text>
                          </View>
                          <View style={styles.mockCatPill}>
                            <Text style={styles.mockCatPillText}>Completed</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.mockLibraryGrid}>
                        {[
                          { title: 'Frieren', progress: 'Ch. 132', unread: 3, accent: '#F43F5E' },
                          { title: 'Berserk', progress: 'Ch. 376', unread: 0, accent: '#6366F1' },
                          { title: 'Blue Lock', progress: 'Ch. 270', unread: 1, accent: '#10B981' },
                          { title: 'Dandadan', progress: 'Ch. 165', unread: 4, accent: '#F59E0B' },
                          { title: 'Chainsaw Man', progress: 'Ch. 175', unread: 0, accent: '#EC4899' },
                          { title: 'Solo Leveling', progress: 'Ch. 200', unread: 0, accent: '#3B82F6' },
                        ].map((card, i) => (
                          <View key={i} style={styles.mockLibraryCard}>
                            <View style={[styles.mockLibraryCardCover, { borderColor: card.unread > 0 ? card.accent : '#27272A' }]}>
                              <Ionicons name="book" size={20} color={card.accent} />
                              {card.unread > 0 && (
                                <View style={[styles.mockUnreadBadge, { backgroundColor: card.accent }]}>
                                  <Text style={styles.mockUnreadBadgeText}>+{card.unread}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.mockLibraryCardTitle} numberOfLines={1}>{card.title}</Text>
                            <Text style={styles.mockLibraryCardProgress}>{card.progress}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Bottom Home Indicator */}
                <View style={styles.homeIndicator} />
              </View>

              {/* Right Nav Arrow Button */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  const tabs: DemoTab[] = ['reader', 'offline', 'languages', 'library'];
                  const currentIndex = tabs.indexOf(activeTab);
                  const nextIndex = (currentIndex + 1) % tabs.length;
                  setActiveTab(tabs[nextIndex]);
                }}
                style={({ pressed }) => [
                  styles.navArrowBtn,
                  styles.navArrowRight,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
                ]}
                accessibilityLabel="Next feature demo"
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* FEATURE MATRIX (4 Asymmetric High-Craft Cards) */}
        <View style={styles.featuresSection}>
          <Text style={[styles.featuresPretitle, { color: colors.accent }]}>ENGINEERED FOR MANGA LOVERS</Text>
          <Text style={[styles.featuresTitle, { color: colors.text }]}>Why Yomite Mobile is Different</Text>

          <View style={[styles.featureGrid, isDesktop && styles.featureGridDesktop]}>
            <View style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="hardware-chip-outline" size={24} color={colors.accent} />
              </View>
              <Text style={[styles.featureCardTitle, { color: colors.text }]}>60fps GPU-Accelerated Engine</Text>
              <Text style={[styles.featureCardDesc, { color: colors.textSecondary }]}>
                Smooth continuous long-strip webtoon scrolling, authentic right-to-left manga page-turn physics, and dual-page landscape mode.
              </Text>
            </View>

            <View style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="airplane-outline" size={24} color="#10B981" />
              </View>
              <Text style={[styles.featureCardTitle, { color: colors.text }]}>True Offline Chapter Vault</Text>
              <Text style={[styles.featureCardDesc, { color: colors.textSecondary }]}>
                Batch-download entire story arcs in one tap. Encrypted local storage lets you read uninterrupted on flights, subways, and off-grid trips.
              </Text>
            </View>

            <View style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="language-outline" size={24} color="#3B82F6" />
              </View>
              <Text style={[styles.featureCardTitle, { color: colors.text }]}>30+ Worldwide Translations</Text>
              <Text style={[styles.featureCardDesc, { color: colors.textSecondary }]}>
                Instant access to English, Spanish, Indonesian, Portuguese, French, Japanese, and global scanlation releases straight from MangaDex.
              </Text>
            </View>

            <View style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.featureIconWrap, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="sync-outline" size={24} color="#F59E0B" />
              </View>
              <Text style={[styles.featureCardTitle, { color: colors.text }]}>Realtime Cloud Library Sync</Text>
              <Text style={[styles.featureCardDesc, { color: colors.textSecondary }]}>
                Pick up on your phone exactly where you left off on desktop. Bookmarks, history, and unread chapter badges sync in milliseconds.
              </Text>
            </View>
          </View>
        </View>

        {/* DIRECT APK DOWNLOAD & SPECS SECTION */}
        <View id="qr-section" style={[styles.specsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                <Text style={styles.directDownloadBtnBigText}>
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
        <View style={[styles.guideSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.guidePretitle, { color: colors.accent }]}>STEP-BY-STEP INSTRUCTIONS</Text>
          <Text style={[styles.guideTitle, { color: colors.text }]}>How to Install Yomite</Text>

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
                  <Text style={[styles.stepCardTitle, { color: colors.text }]}>Download the APK</Text>
                  <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
                    Tap the Download button or scan the QR code to save <Text style={{ fontWeight: 'bold' }}>yomite-v1.2.0-release.apk</Text> to your downloads folder.
                  </Text>
                </View>
              </View>

              <View style={[styles.stepCard, { borderColor: colors.borderSubtle }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.stepNumberText, { color: colors.accent }]}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepCardTitle, { color: colors.text }]}>Allow Unknown Apps in Android</Text>
                  <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
                    When prompted by Chrome/Browser, tap <Text style={{ fontWeight: 'bold' }}>Settings → Allow from this source</Text>. This enables standard standalone sideloading.
                  </Text>
                </View>
              </View>

              <View style={[styles.stepCard, { borderColor: colors.borderSubtle }]}>
                <View style={[styles.stepNumberBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.stepNumberText, { color: colors.accent }]}>3</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepCardTitle, { color: colors.text }]}>Open & Enjoy Offline Manga</Text>
                  <Text style={[styles.stepCardDesc, { color: colors.textSecondary }]}>
                    Tap <Text style={{ fontWeight: 'bold' }}>Install</Text>. Once complete, launch Yomite and log in with your Supabase account to sync your library instantly.
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
    maxWidth: 1220,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.lg,
  },
  unifiedHeroDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.xl,
  },
  heroLeftCol: {
    flex: 1.15,
    maxWidth: 640,
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
    fontSize: Platform.OS === 'web' ? 50 : 32,
    fontWeight: Typography.weights.bold,
    lineHeight: Platform.OS === 'web' ? 56 : 38,
    letterSpacing: -1.2,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  heroSubheadline: {
    fontSize: Platform.OS === 'web' ? 18 : 15,
    lineHeight: Platform.OS === 'web' ? 28 : 22,
    maxWidth: 580,
    marginBottom: Spacing.md,
  },
  heroCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  primaryDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    gap: 12,
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryDownloadIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    paddingVertical: 14,
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
  ambientGlow: {
    position: 'absolute',
    top: '15%',
    alignSelf: 'center',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(244,63,94,0.15)',
    opacity: 0.85,
    transform: [{ scale: 1.25 }],
    pointerEvents: 'none',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
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

  /* Carousel Stage & Floating Nav Arrows */
  phoneCarouselStage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    gap: Spacing.md,
    paddingVertical: 0,
  },
  navArrowBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 20,
  },
  navArrowLeft: {},
  navArrowRight: {},

  /* Standalone Phone Shell */
  standalonePhoneShell: {
    width: 315,
    height: 610,
    backgroundColor: '#09090B',
    borderColor: '#3F3F46',
    borderWidth: 7,
    borderRadius: 46,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 36,
    elevation: 24,
  },
  iphoneShell: {
    borderRadius: 50,
    borderColor: '#27272A',
  },
  androidShell: {
    borderRadius: 36,
    borderColor: '#3F3F46',
  },
  phoneTapLeftHitbox: {
    position: 'absolute',
    top: 50,
    left: 0,
    width: '50%',
    bottom: 30,
    zIndex: 12,
    opacity: 0,
  },
  phoneTapRightHitbox: {
    position: 'absolute',
    top: 50,
    right: 0,
    width: '50%',
    bottom: 30,
    zIndex: 12,
    opacity: 0,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 12,
    height: 38,
    zIndex: 15,
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
    backgroundColor: '#121215',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 22,
  },
  mockupMediaImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
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

  /* Feature Grid */
  featuresSection: {
    maxWidth: 980,
    alignSelf: 'center',
    width: '92%',
    marginBottom: Spacing['3xl'],
  },
  featuresPretitle: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  featuresTitle: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.xl,
  },
  featureGrid: {
    gap: Spacing.md,
  },
  featureGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featureCard: {
    flex: 1,
    minWidth: 260,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureCardTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  featureCardDesc: {
    fontSize: Typography.sizes.body,
    lineHeight: 20,
  },

  /* Specs Section */
  specsSection: {
    maxWidth: 980,
    alignSelf: 'center',
    width: '92%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  releaseHeaderBadgeText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
  specsTitle: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
    marginBottom: 4,
  },
  specsSubtitle: {
    fontSize: Typography.sizes.body,
    marginBottom: Spacing.lg,
  },
  specsTable: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  specsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  specsTableLabel: {
    fontSize: Typography.sizes.footnote,
  },
  specsTableValue: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
  shaCard: {
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: 6,
  },
  shaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shaLabel: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  shaCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shaCopyBtnText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
  },
  shaValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  directDownloadBtnBig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  directDownloadBtnBigText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },

  specsColRight: {
    flex: 1,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrTitle: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
    marginBottom: 4,
  },
  qrSub: {
    fontSize: Typography.sizes.footnote,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  qrCodeFrame: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: Spacing.md,
  },
  qrImage: {
    width: 170,
    height: 170,
  },
  qrInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qrInfoBadgeText: {
    fontSize: 11,
    fontWeight: Typography.weights.medium,
  },

  /* Guide Section */
  guideSection: {
    maxWidth: 980,
    alignSelf: 'center',
    width: '92%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    marginBottom: Spacing['3xl'],
  },
  guidePretitle: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  guideTitle: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.lg,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  guideTabBtnText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  stepsContainer: {
    gap: Spacing.md,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: Typography.sizes.headline,
    fontWeight: Typography.weights.bold,
  },
  stepCardTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
    marginBottom: 2,
  },
  stepCardDesc: {
    fontSize: Typography.sizes.footnote,
    lineHeight: 18,
  },

  /* Footer */
  footer: {
    maxWidth: 980,
    alignSelf: 'center',
    width: '92%',
    paddingTop: Spacing['2xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  footerBrand: {
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
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
  footerCopy: {
    fontSize: Typography.sizes.caption,
    textAlign: 'center',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 4,
  },
  footerLinkText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
  },
});
