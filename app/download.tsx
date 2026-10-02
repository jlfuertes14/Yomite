/**
 * Yomite Mobile App Promotion & Direct Download Page
 * Aesthetic: Editorial Manga Craft — 0% AI Slop (Impeccable Design System)
 * Features: Interactive Sliding Feature Carousel (space-saving), Authentic Flagship
 * Device Mockups, Perfectly Centered Grid, Direct APK Download & Sideloading Hub.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Radius, Spacing, Typography } from '../constants/Colors';
import { useThemeColors } from '../src/hooks/useThemeColor';
import { triggerHaptic } from '../src/utils/haptics';
import { useDocumentTitle } from '../src/utils/useDocumentTitle';

// App Specifications & Release Metadata
const APP_RELEASE = {
  version: 'v1.2.2',
  buildNumber: '106',
  releaseDate: 'September 2026',
  fileSize: '118.86 MB',
  minAndroid: 'Android 8.0 (Oreo) or higher',
  minIos: 'iOS 15.0+ (via Web PWA)',
  architecture: 'Universal (ARM64 & x86_64)',
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  apkDownloadUrl: 'https://expo.dev/accounts/chiro14/projects/yomite/builds/2675b251-7b47-4886-9769-f669f55a9691',
};





export default function AppDownloadScreen() {
  useDocumentTitle('Get App — Yomite');
  const colors = useThemeColors();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 960;
  const isTablet = windowWidth >= 640 && windowWidth < 960;
  const isMobile = windowWidth < 640;

  // Hero Video state
  const videoRef = useRef<any>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(true);

  const toggleVideoMute = () => {
    triggerHaptic();
    if (Platform.OS === 'web' && videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsVideoMuted(videoRef.current.muted);
    }
  };

  // Hero Text Left-to-Right Staggered Motion (Like Mascot Walking)
  const heroSlideAnim = useRef(new Animated.Value(-60)).current;
  const heroFadeAnim = useRef(new Animated.Value(0)).current;
  const headlineSlideAnim = useRef(new Animated.Value(-50)).current;
  const headlineFadeAnim = useRef(new Animated.Value(0)).current;
  const subheadSlideAnim = useRef(new Animated.Value(-40)).current;
  const subheadFadeAnim = useRef(new Animated.Value(0)).current;
  const ctaSlideAnim = useRef(new Animated.Value(-35)).current;
  const ctaFadeAnim = useRef(new Animated.Value(0)).current;
  const commitmentsSlideAnim = useRef(new Animated.Value(-30)).current;
  const commitmentsFadeAnim = useRef(new Animated.Value(0)).current;
  const heroBobAnim = useRef(new Animated.Value(0)).current;

  // Staggered entrance from left to right & walking rhythm bob
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        if (videoRef.current) videoRef.current.pause();
        heroSlideAnim.setValue(0);
        heroFadeAnim.setValue(1);
        headlineSlideAnim.setValue(0);
        headlineFadeAnim.setValue(1);
        subheadSlideAnim.setValue(0);
        subheadFadeAnim.setValue(1);
        ctaSlideAnim.setValue(0);
        ctaFadeAnim.setValue(1);
        commitmentsSlideAnim.setValue(0);
        commitmentsFadeAnim.setValue(1);
        return;
      }

      // Ensure video plays once from start on page load / reload
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    }

    Animated.stagger(70, [
      Animated.parallel([
        Animated.timing(heroSlideAnim, {
          toValue: 0,
          duration: 750,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(heroFadeAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.parallel([
        Animated.timing(headlineSlideAnim, {
          toValue: 0,
          duration: 750,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(headlineFadeAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.parallel([
        Animated.timing(subheadSlideAnim, {
          toValue: 0,
          duration: 750,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(subheadFadeAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.parallel([
        Animated.timing(ctaSlideAnim, {
          toValue: 0,
          duration: 750,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ctaFadeAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.parallel([
        Animated.timing(commitmentsSlideAnim, {
          toValue: 0,
          duration: 750,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(commitmentsFadeAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ]).start(() => {
      // Subtle walking rhythm bob animation after entrance
      Animated.loop(
        Animated.sequence([
          Animated.timing(heroBobAnim, {
            toValue: -3,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(heroBobAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    });
  }, []);

  // Expanding Promotional Video Showcase state
  const promoSectionRef = useRef<any>(null);
  const promoVideoRef = useRef<HTMLVideoElement | null>(null);
  const [expandProgress, setExpandProgress] = useState(0); // 0 (small rounded) to 1 (full page)
  const promoTargetRadius = Math.round(isDesktop ? (48 - expandProgress * 24) : (36 - expandProgress * 16));
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const [isPromoPlaying, setIsPromoPlaying] = useState(false);
  const [isPromoMuted, setIsPromoMuted] = useState(true);

  // Floating Hover Cursor & Lightbox state
  const [isHoveringVideo, setIsHoveringVideo] = useState(false);
  const [videoCursorPos, setVideoCursorPos] = useState({ x: 0, y: 0 });
  const [isPromoLightboxOpen, setIsPromoLightboxOpen] = useState(false);
  const [isLightboxPlaying, setIsLightboxPlaying] = useState(true);
  const [isLightboxMuted, setIsLightboxMuted] = useState(false);
  const [lightboxTimeCurrent, setLightboxTimeCurrent] = useState(0);
  const [lightboxDuration, setLightboxDuration] = useState(0);
  const lightboxVideoRef = useRef<HTMLVideoElement | null>(null);

  // Strictly gate playback: only play when fully expanded (progress >= 0.98) and visible
  const checkVideoState = useCallback((progressVal: number) => {
    if (!promoVideoRef.current || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const el = promoSectionRef.current;
    const domNode = el?.getDOMNode ? el.getDOMNode() : (el?._nativeNode || el);
    if (!domNode || typeof domNode.getBoundingClientRect !== 'function') return;

    const rect = domNode.getBoundingClientRect();
    const windowHeight = window.innerHeight || 800;
    const isVisible = rect.top < windowHeight && rect.bottom > 80;
    const isFullyExpanded = progressVal >= 0.98;

    if (isFullyExpanded && isVisible) {
      if (promoVideoRef.current.paused) {
        promoVideoRef.current.play().then(() => {
          setIsPromoPlaying(true);
        }).catch(() => {
          if (promoVideoRef.current) {
            promoVideoRef.current.muted = true;
            setIsPromoMuted(true);
            promoVideoRef.current.play().then(() => setIsPromoPlaying(true)).catch(() => {});
          }
        });
      }
    } else if (progressVal < 0.95 || !isVisible) {
      if (!promoVideoRef.current.paused) {
        promoVideoRef.current.pause();
        setIsPromoPlaying(false);
      }
    }
  }, []);

  // Compute smooth progress using VideoScrollHero sticky scroll calculation
  const computeTargetProgress = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return 0;
    const el = promoSectionRef.current;
    const domNode = el?.getDOMNode ? el.getDOMNode() : (el?._nativeNode || el);
    if (!domNode || typeof domNode.getBoundingClientRect !== 'function') return 0;

    const rect = domNode.getBoundingClientRect();
    const windowHeight = window.innerHeight || 800;
    const containerHeight = domNode.offsetHeight || domNode.clientHeight || (windowHeight * 1.85);

    // Calculate scroll progress based on container position (from VideoScrollHero)
    const scrolled = Math.max(0, -rect.top);
    const maxScroll = Math.max(1, containerHeight - windowHeight);
    const raw = Math.max(0, Math.min(1, scrolled / maxScroll));

    // Smoothstep Hermite polynomial curve: f(t) = t * t * (3 - 2 * t)
    return raw * raw * (3 - 2 * raw);
  }, []);

  // Butter-smooth RAF interpolation loop (0.14 lerp factor eliminates scroll wheel stepped ticks)
  const updateLoop = useCallback(() => {
    const target = targetProgressRef?.current ?? 0;
    const current = currentProgressRef?.current ?? 0;
    const diff = target - current;

    if (Math.abs(diff) > 0.001) {
      const next = current + diff * 0.14;
      if (currentProgressRef) currentProgressRef.current = next;
      setExpandProgress(next);
      checkVideoState(next);
      if (rafIdRef) {
        rafIdRef.current = requestAnimationFrame(updateLoop);
      }
    } else {
      if (currentProgressRef) currentProgressRef.current = target;
      setExpandProgress(target);
      checkVideoState(target);
      if (rafIdRef) {
        rafIdRef.current = null;
      }
    }
  }, [checkVideoState]);

  const onScrollOrResize = useCallback(() => {
    const target = computeTargetProgress();
    if (targetProgressRef) {
      targetProgressRef.current = target;
    }
    if (rafIdRef && !rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(updateLoop);
    }
  }, [computeTargetProgress, updateLoop]);

  // Clean up any stale Lenis classes and track scroll progress smoothly
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Remove any stale Lenis style tag or classes that collapse React Native Web's #root height
    const staleStyle = document.getElementById('lenis-smooth-scroll-css');
    if (staleStyle) staleStyle.remove();
    document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');
    document.body.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    // Initial check on mount
    const timer = setTimeout(() => {
      const initial = computeTargetProgress();
      targetProgressRef.current = initial;
      currentProgressRef.current = initial;
      setExpandProgress(initial);
      checkVideoState(initial);
    }, 120);

    return () => {
      clearTimeout(timer);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [computeTargetProgress, checkVideoState, onScrollOrResize]);

  const togglePromoPlay = () => {
    triggerHaptic();
    if (promoVideoRef.current) {
      if (promoVideoRef.current.paused) {
        // If not fully expanded, smoothly scroll to fully expand it
        if (currentProgressRef.current < 0.98 && promoSectionRef.current && Platform.OS === 'web') {
          const el = promoSectionRef.current;
          const domNode = el?.getDOMNode ? el.getDOMNode() : (el?._nativeNode || el);
          if (domNode && typeof domNode.scrollIntoView === 'function') {
            domNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        promoVideoRef.current.play().then(() => setIsPromoPlaying(true)).catch(() => {});
      } else {
        promoVideoRef.current.pause();
        setIsPromoPlaying(false);
      }
    }
  };

  // Open / Close promo video fullscreen lightbox
  const openPromoLightbox = () => {
    triggerHaptic();
    setIsPromoLightboxOpen(true);
    setIsLightboxPlaying(true);
    if (promoVideoRef.current && !promoVideoRef.current.paused) {
      promoVideoRef.current.pause();
    }
  };

  const closePromoLightbox = () => {
    triggerHaptic();
    if (lightboxVideoRef.current) {
      lightboxVideoRef.current.pause();
    }
    setIsPromoLightboxOpen(false);
    if (currentProgressRef.current >= 0.98 && promoVideoRef.current) {
      promoVideoRef.current.play().catch(() => {});
    }
  };

  // Keyboard escape listener to dismiss lightbox
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPromoLightboxOpen) {
        closePromoLightbox();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPromoLightboxOpen]);

  const toggleLightboxPlay = () => {
    triggerHaptic();
    if (lightboxVideoRef.current) {
      if (lightboxVideoRef.current.paused) {
        lightboxVideoRef.current.play().then(() => setIsLightboxPlaying(true)).catch(() => {});
      } else {
        lightboxVideoRef.current.pause();
        setIsLightboxPlaying(false);
      }
    }
  };

  const toggleLightboxMute = () => {
    triggerHaptic();
    if (lightboxVideoRef.current) {
      const next = !lightboxVideoRef.current.muted;
      lightboxVideoRef.current.muted = next;
      setIsLightboxMuted(next);
    }
  };

  const handleLightboxTimeUpdate = () => {
    if (lightboxVideoRef.current) {
      setLightboxTimeCurrent(lightboxVideoRef.current.currentTime);
      if (!lightboxDuration && lightboxVideoRef.current.duration) {
        setLightboxDuration(lightboxVideoRef.current.duration);
      }
    }
  };

  const handleLightboxScrub = (e: any) => {
    if (Platform.OS === 'web' && lightboxVideoRef.current && lightboxDuration > 0) {
      const rect = e.currentTarget?.getBoundingClientRect();
      if (rect) {
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        lightboxVideoRef.current.currentTime = pct * lightboxDuration;
        setLightboxTimeCurrent(pct * lightboxDuration);
      }
    }
  };

  const toggleLightboxFullscreen = () => {
    triggerHaptic();
    if (Platform.OS === 'web' && lightboxVideoRef.current) {
      const v = lightboxVideoRef.current as any;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else if (v.requestFullscreen) {
        v.requestFullscreen().catch(() => {});
      } else if (v.webkitRequestFullscreen) {
        v.webkitRequestFullscreen();
      }
    }
  };

  const formatVideoTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };


  // Specs & Guide state
  const [copiedSha, setCopiedSha] = useState(false);
  const [showShaDrawer, setShowShaDrawer] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'android' | 'ios'>('android');

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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#09090B' }]} edges={['top', 'left', 'right']}>
      {/* ── TOP NAVBAR ── */}
      <View style={[styles.navbarOuter, { borderBottomColor: 'rgba(255, 255, 255, 0.08)', backgroundColor: '#09090B' }]}>
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
              <Text style={[styles.brandTitle, { color: '#FFFFFF' }]}>Yomite</Text>
              <Text style={[styles.brandTagline, { color: '#71717A' }]}>Manga Reader</Text>
            </View>
          </Pressable>

          <View style={styles.navActions}>
            <Pressable
              accessibilityRole="button"
              aria-label="Open Web App"
              onPress={() => router.push('/(tabs)' as any)}
              style={({ pressed }) => [
                styles.navSecondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="desktop-outline" size={14} color="#A1A1AA" aria-hidden={true} />
              <Text style={styles.navSecondaryText}>
                {isMobile ? 'Web' : 'Open Web App'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              aria-label="Download APK Package"
              onPress={handleDownloadApk}
              style={({ pressed }) => [
                styles.navPrimaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="arrow-down-circle" size={15} color="#000000" aria-hidden={true} />
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
        onScroll={Platform.OS === 'web' ? onScrollOrResize : undefined}
        scrollEventThrottle={16}
      >
        {/* ════════════════════════════════════════════════════════════════════════
            HERO SECTION: Full-bleed background video with high-contrast text overlay
           ════════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.heroSectionWrap, isDesktop && styles.heroSectionWrapDesktop]}>
          {/* 1. Full-Bleed Video Asset Background Layer */}
          <View style={styles.heroBackgroundVideoWrap} pointerEvents="none">
            {Platform.OS === 'web' ? (
              React.createElement(
                'video',
                {
                  ref: videoRef,
                  autoPlay: true,
                  loop: false,
                  muted: isVideoMuted,
                  playsInline: true,
                  style: {
                    position: 'absolute',
                    top: 0,
                    left: isDesktop ? '-90px' : (isTablet ? '-45px' : '0px'),
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: isDesktop ? '100% center' : 'center center',
                    display: 'block',
                    backgroundColor: '#09090B',
                  },
                  'aria-label': 'Yomite Manga Reader anime mascot promotional animation',
                },
                React.createElement('source', { src: '/PROMPT5-16by9.mp4', type: 'video/mp4' }),
                React.createElement('source', { src: './PROMPT5-16by9.mp4', type: 'video/mp4' }),
                React.createElement('source', { src: '/assets/videos/PROMPT5-16by9.mp4', type: 'video/mp4' }),
              )
            ) : (
              <Image
                source={require('../assets/images/mascot.png')}
                style={styles.heroFallbackImage}
                contentFit="cover"
              />
            )}

            {/* Readability Scrim (Left-to-Right on Desktop, Top-to-Bottom on Mobile) */}
            {isDesktop ? (
              <LinearGradient
                colors={[
                  'rgba(9, 9, 11, 0.98)',
                  'rgba(9, 9, 11, 0.92)',
                  'rgba(9, 9, 11, 0.50)',
                  'rgba(9, 9, 11, 0.10)',
                  'rgba(9, 9, 11, 0.35)',
                ]}
                locations={[0, 0.45, 0.70, 0.88, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            ) : (
              <LinearGradient
                colors={[
                  'rgba(9, 9, 11, 0.90)',
                  'rgba(9, 9, 11, 0.76)',
                  'rgba(9, 9, 11, 0.94)',
                ]}
                locations={[0, 0.45, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            )}

            {/* Vertical Edge Feathering (blends into top navbar and next section below) */}
            <LinearGradient
              colors={['rgba(9, 9, 11, 0.70)', 'transparent', 'transparent', '#09090B']}
              locations={[0, 0.10, 0.85, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </View>

          {/* 2. Hero Content Overlay Container (High contrast, accessible typography) */}
          {/* 2. Hero Content Overlay Container (High contrast, animated typography) */}
          <View style={[styles.heroOverlayContainer, isDesktop && styles.heroOverlayContainerDesktop]}>
            <View style={[styles.heroContentWrap, isDesktop && styles.heroContentWrapDesktop]}>
              {/* Release Bar */}
              <Animated.View
                style={[
                  styles.heroReleaseBar,
                  {
                    opacity: heroFadeAnim,
                    transform: [{ translateX: heroSlideAnim }],
                  },
                ]}
              >
                <View style={styles.releaseTag}>
                  <View style={styles.pulseDot} />
                  <Text style={[styles.releaseTagText, { color: '#FFFFFF' }]}>
                    {APP_RELEASE.version} STABLE
                  </Text>
                </View>
                <Text style={[styles.releaseMetaText, { color: '#A1A1AA' }]}>
                  Android 8.0+ • Free & Open Source
                </Text>
              </Animated.View>

              {/* Headline */}
              <Animated.View
                style={{
                  opacity: headlineFadeAnim,
                  transform: [
                    { translateX: headlineSlideAnim },
                    { translateY: heroBobAnim },
                  ],
                }}
              >
                <Text
                  accessibilityRole="header"
                  aria-level={1}
                  style={[
                    styles.heroHeadline,
                    { color: '#FFFFFF' },
                    isDesktop && styles.heroHeadlineDesktop,
                    isMobile && styles.heroHeadlineMobile,
                    isTablet && styles.heroHeadlineTablet,
                  ]}
                >
                  The art of reading manga,{'\n'}
                  <Text style={{ color: '#FFFFFF', opacity: 0.9 }}>pure and unfiltered.</Text>
                </Text>
              </Animated.View>

              {/* Subheadline */}
              <Animated.View
                style={{
                  opacity: subheadFadeAnim,
                  transform: [{ translateX: subheadSlideAnim }],
                }}
              >
                <Text
                  style={[
                    styles.heroSubheadline,
                    { color: '#A1A1AA' },
                    isDesktop && styles.heroSubheadlineDesktop,
                    isMobile && styles.heroSubheadlineMobile,
                  ]}
                >
                  Zero ads, zero coin paywalls, and zero compression. Experience fluid 60&nbsp;fps page turns, true offline volume downloads, and official MangaDex scanlations in 30+ languages.
                </Text>
              </Animated.View>

              {/* CTA Group with Integrated Speaker Icon */}
              <Animated.View
                style={[
                  styles.heroCtaGroup,
                  isMobile && styles.heroCtaGroupMobile,
                  {
                    opacity: ctaFadeAnim,
                    transform: [{ translateX: ctaSlideAnim }],
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  aria-label="Download Yomite Android APK"
                  onPress={handleDownloadApk}
                  style={({ pressed }) => [
                    styles.heroDownloadButton,
                    isMobile && { width: '100%', justifyContent: 'center' },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons name="logo-android" size={22} color="#000000" aria-hidden={true} />
                  <View style={styles.heroDownloadLabels}>
                    <Text style={styles.heroDownloadMain}>Download Yomite for Android</Text>
                    <Text style={styles.heroDownloadMeta}>
                      Direct APK • {APP_RELEASE.fileSize} • Clean Build
                    </Text>
                  </View>
                  <Ionicons name="arrow-down" size={18} color="#000000" aria-hidden={true} style={{ marginLeft: 6 }} />
                </Pressable>

                {!isMobile && (
                  <Pressable
                    accessibilityRole="button"
                    aria-label="Scan QR Code from Phone"
                    onPress={handleScrollToQr}
                    style={({ pressed }) => [
                      styles.heroQrButton,
                      { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.16)' },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" aria-hidden={true} />
                    <Text style={[styles.heroQrText, { color: '#FFFFFF' }]}>Scan QR from Phone</Text>
                  </Pressable>
                )}

                {/* Speaker Audio Toggle inside Hero Text Section */}
                {Platform.OS === 'web' && (
                  <Pressable
                    accessibilityRole="button"
                    aria-label={isVideoMuted ? 'Unmute video audio' : 'Mute video audio'}
                    onPress={toggleVideoMute}
                    style={({ pressed }) => [
                      styles.heroSpeakerButton,
                      {
                        backgroundColor: isVideoMuted ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.16)',
                        borderColor: isVideoMuted ? 'rgba(255, 255, 255, 0.14)' : '#FFFFFF',
                      },
                      isMobile && { width: '100%', justifyContent: 'center' },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Ionicons
                      name={isVideoMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                      size={20}
                      color="#FFFFFF"
                      aria-hidden={true}
                    />
                    {isMobile && (
                      <Text style={[styles.heroSpeakerText, { color: '#FFFFFF' }]}>
                        {isVideoMuted ? 'Sound Off' : 'Sound On'}
                      </Text>
                    )}
                  </Pressable>
                )}
              </Animated.View>

              {/* Commitments Row */}
              <Animated.View
                style={[
                  styles.commitmentsRow,
                  {
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    opacity: commitmentsFadeAnim,
                    transform: [{ translateX: commitmentsSlideAnim }],
                  },
                ]}
              >
                <View style={styles.commitmentItem}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#FFFFFF" aria-hidden={true} />
                  <Text style={[styles.commitmentText, { color: '#A1A1AA' }]}>
                    100% Free & Open Source
                  </Text>
                </View>
                <View style={styles.commitmentDivider} />
                <View style={styles.commitmentItem}>
                  <Ionicons name="phone-portrait-outline" size={16} color="#FFFFFF" aria-hidden={true} />
                  <Text style={[styles.commitmentText, { color: '#A1A1AA' }]}>
                    True Offline Storage
                  </Text>
                </View>
                <View style={styles.commitmentDivider} />
                <View style={styles.commitmentItem}>
                  <Ionicons name="sync-outline" size={16} color="#FFFFFF" aria-hidden={true} />
                  <Text style={[styles.commitmentText, { color: '#A1A1AA' }]}>
                    Sub-50ms Cloud Sync
                  </Text>
                </View>
              </Animated.View>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════════
            SCROLL-EXPANDING PROMOTIONAL VIDEO SHOWCASE (VideoScrollHero sticky track)
           ════════════════════════════════════════════════════════════════════════ */}
        <View
          ref={promoSectionRef}
          style={[
            styles.promoScrollTrack,
            Platform.OS === 'web'
              ? ({
                  height: isDesktop ? '185vh' : '160vh',
                  position: 'relative',
                  width: '100%',
                } as any)
              : {},
          ]}
        >
          {/* Fixed Sticky Center Viewport */}
          <View
            style={[
              styles.promoStickyViewport,
              Platform.OS === 'web'
                ? ({
                    position: 'sticky',
                    top: 0,
                    height: '100vh',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    paddingHorizontal: isDesktop ? 48 : 16,
                  } as any)
                : {},
            ]}
          >
            <View
              style={[
                styles.promoVideoCard,
                Platform.OS === 'web'
                  ? ({
                      width: isDesktop ? `${75 + expandProgress * 25}%` : `${88 + expandProgress * 12}%`,
                      maxWidth: 1600,
                      borderRadius: promoTargetRadius,
                      WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                      maskImage: 'radial-gradient(white, black)',
                      transform: [
                        { scale: isDesktop ? 0.78 + expandProgress * 0.22 : 0.86 + expandProgress * 0.14 },
                      ],
                      transformOrigin: 'center center',
                      boxShadow: `0 ${Math.round(24 + expandProgress * 36)}px ${Math.round(56 + expandProgress * 64)}px rgba(0, 0, 0, ${0.80 + expandProgress * 0.18}), 0 0 0 1px rgba(255, 255, 255, ${0.10 + expandProgress * 0.14})`,
                      borderColor: expandProgress >= 0.98 ? 'rgba(255, 255, 255, 0.32)' : 'rgba(255, 255, 255, 0.15)',
                      borderWidth: 1.5,
                      willChange: 'transform, border-radius, width',
                      transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
                      cursor: 'pointer',
                    } as any)
                  : {},
              ]}
              {...(Platform.OS === 'web'
                ? {
                    onMouseMove: (e: any) => {
                      const rect = e.currentTarget?.getBoundingClientRect();
                      if (rect) {
                        setVideoCursorPos({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                      }
                    },
                    onMouseEnter: () => setIsHoveringVideo(true),
                    onMouseLeave: () => setIsHoveringVideo(false),
                    onClick: openPromoLightbox,
                  }
                : {})}
            >
              {/* Floating "Play intro" Hover Rectangular Badge (No Pill) */}
              {Platform.OS === 'web' && (
                <View
                  style={[
                    styles.promoCursorBadge,
                    {
                      left: videoCursorPos.x || 160,
                      top: videoCursorPos.y || 120,
                      opacity: isHoveringVideo ? 1 : (isMobile ? 1 : 0),
                      transform: [
                        { translateX: -54 },
                        { translateY: -18 },
                        { scale: isHoveringVideo ? 1 : (isMobile ? 1 : 0.75) },
                      ],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Ionicons name="play" size={12} color="#000000" aria-hidden={true} style={{ marginRight: 6 }} />
                  <Text style={styles.promoCursorBadgeText}>PLAY INTRO</Text>
                </View>
              )}

              {/* Inner Display Screen Area */}
              <View
                style={[
                  styles.promoScreenArea,
                  Platform.OS === 'web'
                    ? ({
                        borderRadius: promoTargetRadius,
                        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                        maskImage: 'radial-gradient(white, black)',
                      } as any)
                    : {},
                ]}
              >
                {/* HTML5 Video Element with yomite-promotional-vid.mp4 */}
                {Platform.OS === 'web' ? (
                  React.createElement(
                    'video',
                    {
                      ref: promoVideoRef,
                      loop: true,
                      muted: isPromoMuted,
                      playsInline: true,
                      preload: 'auto',
                      onLoadedData: () => checkVideoState(currentProgressRef.current),
                      onPlay: () => setIsPromoPlaying(true),
                      onPause: () => setIsPromoPlaying(false),
                      style: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        backgroundColor: '#09090B',
                        cursor: 'pointer',
                        borderRadius: 'inherit',
                        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                        maskImage: 'radial-gradient(white, black)',
                        overflow: 'hidden',
                      },
                      'aria-label': 'Yomite promotional video showing fluid manga reading experience',
                    },
                    React.createElement('source', { src: '/yomite-promotional-vid.mp4', type: 'video/mp4' }),
                    React.createElement('source', { src: './yomite-promotional-vid.mp4', type: 'video/mp4' }),
                    React.createElement('source', { src: '/assets/videos/yomite-promotional-vid.mp4', type: 'video/mp4' }),
                  )
                ) : (
                  <View style={styles.promoNativeFallback}>
                    <Text style={{ color: '#A1A1AA' }}>Video preview available on web view</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════════
            DIRECT APK DOWNLOAD & PHONE QR HUB (FLAT CONTAINER-FREE DESIGN)
           ════════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionWrapper, isDesktop && styles.sectionWrapperDesktop]}>
          <View
            id="download-hub"
            style={[
              styles.downloadHubSection,
              isMobile && styles.downloadHubSectionMobile,
            ]}
          >
            <View style={[styles.downloadHubGrid, isDesktop && styles.downloadHubGridDesktop]}>
              {/* Left: Official Release Specification */}
              <View style={styles.downloadHubLeft}>
                <View style={styles.verifiedTag}>
                  <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" aria-hidden={true} />
                  <Text style={styles.verifiedTagText}>
                    OFFICIAL RELEASE • EXPO CLOUD SIGNED
                  </Text>
                </View>

                <Text accessibilityRole="header" aria-level={2} style={styles.hubTitle}>
                  Yomite for Android
                </Text>
                <Text style={styles.hubSubtitle}>
                  Direct APK sideload package with zero telemetry, zero analytics trackers, and automatic in-app update notifications.
                </Text>

                {/* Flat Open Specifications Table (Zero Container Cards) */}
                <View style={styles.flatSpecsList}>
                  <View style={styles.flatSpecRow}>
                    <Text style={styles.flatSpecLabel}>VERSION</Text>
                    <Text style={styles.flatSpecValue}>{APP_RELEASE.version} (Build {APP_RELEASE.buildNumber})</Text>
                  </View>
                  <View style={styles.flatSpecRow}>
                    <Text style={styles.flatSpecLabel}>PACKAGE SIZE</Text>
                    <Text style={styles.flatSpecValue}>{APP_RELEASE.fileSize} • Clean Binary</Text>
                  </View>
                  <View style={styles.flatSpecRow}>
                    <Text style={styles.flatSpecLabel}>ARCHITECTURE</Text>
                    <Text style={styles.flatSpecValue}>Universal (ARM64 & x86_64)</Text>
                  </View>
                  <View style={styles.flatSpecRow}>
                    <Text style={styles.flatSpecLabel}>COMPATIBILITY</Text>
                    <Text style={styles.flatSpecValue}>{APP_RELEASE.minAndroid}</Text>
                  </View>
                </View>

                {/* Flat Pure White Primary Download Button (No Shadows / No Elevation) */}
                <Pressable
                  accessibilityRole="button"
                  aria-label={`Download Yomite ${APP_RELEASE.version} APK`}
                  onPress={handleDownloadApk}
                  style={({ pressed }) => [
                    styles.bigDownloadButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Ionicons name="arrow-down-circle" size={22} color="#000000" aria-hidden={true} />
                  <View style={styles.bigDownloadTextCol}>
                    <Text style={styles.bigDownloadTitle}>
                      Download {APP_RELEASE.version} APK
                    </Text>
                    <Text style={styles.bigDownloadSub}>
                      {APP_RELEASE.fileSize} • Direct Expo Build
                    </Text>
                  </View>
                </Pressable>

                {/* Flat Cryptographic Verification Toggle & Monospace Hash */}
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
                      color="#FFFFFF"
                      aria-hidden={true}
                    />
                    <Text style={styles.checksumToggleText}>
                      {showShaDrawer ? 'Hide Cryptographic Digest' : 'Verify SHA-256 Cryptographic Digest'}
                    </Text>
                  </Pressable>

                  {showShaDrawer && (
                    <View style={styles.flatShaBlock}>
                      <View style={styles.shaHeaderRow}>
                        <Text style={styles.shaTitle}>SHA-256 DIGEST (STANDALONE BINARY)</Text>
                        <Pressable
                          accessibilityRole="button"
                          aria-label="Copy SHA-256 hash"
                          onPress={handleCopySha}
                          style={[
                            styles.shaCopyBtn,
                            copiedSha && { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
                          ]}
                        >
                          <Ionicons
                            name={copiedSha ? 'checkmark' : 'copy-outline'}
                            size={12}
                            color={copiedSha ? '#000000' : '#FFFFFF'}
                            aria-hidden={true}
                          />
                          <Text style={[styles.shaCopyText, { color: copiedSha ? '#000000' : '#FFFFFF' }]}>
                            {copiedSha ? 'Copied' : 'Copy'}
                          </Text>
                        </Pressable>
                      </View>
                      <Text style={styles.shaHashString} numberOfLines={1} selectable>
                        {APP_RELEASE.sha256}
                      </Text>
                      <Text style={styles.terminalHelperCode} selectable>
                        $ echo "{APP_RELEASE.sha256}  yomite.apk" | sha256sum -c
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Right: Flat Phone QR Scanner (Zero Nested Containers) */}
              <View style={styles.downloadHubRight}>
                <View style={styles.flatQrColumn}>
                  <Text accessibilityRole="header" aria-level={3} style={styles.qrHeading}>
                    Scan from Mobile
                  </Text>
                  <Text style={styles.qrInstructions}>
                    Point your Android camera here to download package directly:
                  </Text>

                  {/* Clean Flat White QR Code Image (No Container Boxes) */}
                  <Image
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(APP_RELEASE.apkDownloadUrl)}&bgcolor=FFFFFF&color=09090B&margin=8`,
                    }}
                    style={styles.flatQrImage}
                    contentFit="contain"
                  />

                  <View style={styles.qrHelperRow}>
                    <Ionicons name="camera-outline" size={14} color="#A1A1AA" aria-hidden={true} />
                    <Text style={styles.qrHelperText}>
                      Direct sideload link • Zero ad redirects
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════════
            CLEAN SIDELOAD & INSTALLATION GUIDE (FLAT OPEN SETUP MANUAL)
           ════════════════════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionWrapper, isDesktop && styles.sectionWrapperDesktop]}>
          <View
            style={[
              styles.guideContainer,
              isMobile && styles.guideContainerMobile,
            ]}
          >
            <View style={styles.guideHeaderGroup}>
              <Text style={styles.sectionEyebrow}>
                SETUP MANUAL
              </Text>
              <Text accessibilityRole="header" aria-level={2} style={styles.guideMainTitle}>
                How to install Yomite
              </Text>
              <Text style={styles.guideSubtitle}>
                Installation takes under 60&nbsp;seconds. Select your platform below:
              </Text>
            </View>

            {/* Flat Platform Switcher (No Box Containers) */}
            <View style={styles.flatPlatformTabs}>
              <Pressable
                accessibilityRole="button"
                aria-label="View Android APK sideload instructions"
                onPress={() => {
                  triggerHaptic();
                  setActiveGuideTab('android');
                }}
                style={[
                  styles.flatTabBtn,
                  activeGuideTab === 'android' && styles.flatTabBtnActive,
                ]}
              >
                <Ionicons
                  name="logo-android"
                  size={15}
                  color={activeGuideTab === 'android' ? '#000000' : '#A1A1AA'}
                  aria-hidden={true}
                />
                <Text
                  style={[
                    styles.flatTabText,
                    activeGuideTab === 'android' && styles.flatTabTextActive,
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
                  styles.flatTabBtn,
                  activeGuideTab === 'ios' && styles.flatTabBtnActive,
                ]}
              >
                <Ionicons
                  name="logo-apple"
                  size={15}
                  color={activeGuideTab === 'ios' ? '#000000' : '#A1A1AA'}
                  aria-hidden={true}
                />
                <Text
                  style={[
                    styles.flatTabText,
                    activeGuideTab === 'ios' && styles.flatTabTextActive,
                  ]}
                >
                  iPhone & iPad (PWA)
                </Text>
              </Pressable>
            </View>

            {/* Flat Open Step Sequence (Zero Card Containers) */}
            {activeGuideTab === 'android' ? (
              <View style={styles.flatStepList}>
                <View style={styles.flatStepRow}>
                  <Text style={styles.flatStepIndex}>01</Text>
                  <View style={styles.flatStepBodyCol}>
                    <Text accessibilityRole="header" aria-level={3} style={styles.flatStepTitle}>
                      Download the APK package
                    </Text>
                    <Text style={styles.flatStepText}>
                      Tap <Text style={styles.inlineKbd}>Download APK</Text> above or scan the QR code with your camera. The package downloads directly from the official Expo build cloud.
                    </Text>
                  </View>
                </View>

                <View style={styles.flatStepRow}>
                  <Text style={styles.flatStepIndex}>02</Text>
                  <View style={styles.flatStepBodyCol}>
                    <Text accessibilityRole="header" aria-level={3} style={styles.flatStepTitle}>
                      Install from Browser Downloads
                    </Text>
                    <Text style={styles.flatStepText}>
                      Open your browser downloads list (in Chrome, tap <Text style={styles.inlineKbd}>⋮ Menu → Downloads</Text>). Tap the downloaded <Text style={styles.inlineKbd}>yomite-v{APP_RELEASE.version}.apk</Text> file. If prompted by Android security, enable <Text style={styles.inlineKbd}>Allow from this source</Text>.
                    </Text>
                  </View>
                </View>

                <View style={[styles.flatStepRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.flatStepIndex}>03</Text>
                  <View style={styles.flatStepBodyCol}>
                    <Text accessibilityRole="header" aria-level={3} style={styles.flatStepTitle}>
                      Launch Yomite & Start Reading
                    </Text>
                    <Text style={styles.flatStepText}>
                      Launch Yomite from your app drawer. Your offline library, MangaDex catalog, and 60&nbsp;fps reader are active immediately with zero sign-ups or accounts required.
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.flatStepList}>
                <View style={styles.flatStepRow}>
                  <Text style={styles.flatStepIndex}>01</Text>
                  <View style={styles.flatStepBodyCol}>
                    <Text accessibilityRole="header" aria-level={3} style={styles.flatStepTitle}>
                      Open in Apple Safari
                    </Text>
                    <Text style={styles.flatStepText}>
                      Navigate to Yomite on your iPhone or iPad using Apple’s default Mobile Safari browser.
                    </Text>
                  </View>
                </View>

                <View style={styles.flatStepRow}>
                  <Text style={styles.flatStepIndex}>02</Text>
                  <View style={styles.flatStepBodyCol}>
                    <Text accessibilityRole="header" aria-level={3} style={styles.flatStepTitle}>
                      Tap the Share Button
                    </Text>
                    <Text style={styles.flatStepText}>
                      Tap the Safari Share button (the square icon with an upward arrow <Text style={styles.inlineKbd}>⎋ Share</Text> at the bottom center of the screen).
                    </Text>
                  </View>
                </View>

                <View style={[styles.flatStepRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.flatStepIndex}>03</Text>
                  <View style={styles.flatStepBodyCol}>
                    <Text accessibilityRole="header" aria-level={3} style={styles.flatStepTitle}>
                      Select "Add to Home Screen"
                    </Text>
                    <Text style={styles.flatStepText}>
                      Scroll down and tap <Text style={styles.inlineKbd}>Add to Home Screen</Text>. Yomite will run as a standalone, fullscreen progressive web application with native tactile speed.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Flat Open Credibility Row (Zero Box Container) */}
            <View style={styles.flatCredibilityRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" aria-hidden={true} />
              <Text style={styles.flatCredibilityText}>
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Transparent & Open Source:</Text> Built directly via Expo Cloud Infrastructure with zero proprietary telemetry or ad networks. You can verify the source code and build hashes freely.
              </Text>
            </View>
          </View>
        </View>

        {/* ════════════════════════════════════════════════════════════════════════
            FOOTER: Minimalist brand signature
           ════════════════════════════════════════════════════════════════════════ */}
        <View style={styles.footerOuter}>
          <View style={styles.footerInner}>
            <View style={styles.footerBrandRow}>
              <Image
                source={require('../assets/images/mascot.png')}
                style={styles.footerMascot}
                contentFit="cover"
              />
              <Text style={styles.footerBrandText}>Yomite Manga Reader</Text>
            </View>
            <Text style={styles.footerCopyright}>
              Powered by the MangaDex API. 100% Free & Open Source under the MIT License.
            </Text>
            <View style={styles.footerNavLinks}>
              <Pressable
                accessibilityRole="button"
                aria-label="Discover Manga"
                onPress={() => router.push('/(tabs)' as any)}
                style={styles.footerLinkPressable}
              >
                <Text style={styles.footerLink}>Discover</Text>
              </Pressable>
              <Text style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</Text>
              <Pressable
                accessibilityRole="button"
                aria-label="Community"
                onPress={() => router.push('/(tabs)/community' as any)}
                style={styles.footerLinkPressable}
              >
                <Text style={styles.footerLink}>Community</Text>
              </Pressable>
              <Text style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</Text>
              <Pressable
                accessibilityRole="button"
                aria-label="Settings"
                onPress={() => router.push('/(tabs)/settings' as any)}
                style={styles.footerLinkPressable}
              >
                <Text style={styles.footerLink}>Settings</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ════════════════════════════════════════════════════════════════════════
          FULLSCREEN VIDEO LIGHTBOX (with Player Menus, Tracker & Controls)
         ════════════════════════════════════════════════════════════════════════ */}
      {isPromoLightboxOpen && (
        <View
          role="dialog"
          aria-modal={true}
          aria-label="Full screen promotional video"
          style={styles.lightboxBackdrop}
        >
          {/* Backdrop dismissal tap target */}
          <Pressable
            aria-label="Close dialog background"
            onPress={closePromoLightbox}
            style={StyleSheet.absoluteFill}
          />

          {/* Dialog Card Container */}
          <View style={styles.lightboxCard}>
            {/* Top Close Button */}
            <Pressable
              accessibilityRole="button"
              aria-label="Close dialog"
              onPress={closePromoLightbox}
              style={({ pressed }) => [styles.lightboxCloseBtn, pressed && styles.buttonPressed]}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" aria-hidden={true} />
            </Pressable>

            {/* Video Player Display */}
            <View style={styles.lightboxVideoArea}>
              {Platform.OS === 'web' ? (
                React.createElement(
                  'video',
                  {
                    ref: lightboxVideoRef,
                    autoPlay: true,
                    loop: true,
                    muted: isLightboxMuted,
                    playsInline: true,
                    preload: 'auto',
                    onTimeUpdate: handleLightboxTimeUpdate,
                    onLoadedMetadata: handleLightboxTimeUpdate,
                    onPlay: () => setIsLightboxPlaying(true),
                    onPause: () => setIsLightboxPlaying(false),
                    onClick: toggleLightboxPlay,
                    style: {
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      backgroundColor: '#000000',
                      cursor: 'pointer',
                    },
                    'aria-label': 'Yomite promotional video showcase',
                  },
                  React.createElement('source', { src: '/yomite-promotional-vid.mp4', type: 'video/mp4' }),
                  React.createElement('source', { src: './yomite-promotional-vid.mp4', type: 'video/mp4' }),
                  React.createElement('source', { src: '/assets/videos/yomite-promotional-vid.mp4', type: 'video/mp4' }),
                )
              ) : (
                <View style={styles.promoNativeFallback}>
                  <Text style={{ color: '#FAFAFA' }}>Video preview available on web view</Text>
                </View>
              )}
            </View>

            {/* Bottom Player Menus & Control Bar */}
            <View style={styles.lightboxControlBar}>
              {/* Seekable Progress Bar / Tracker */}
              <Pressable
                accessibilityRole="progressbar"
                aria-label="Seek video progress"
                onPress={handleLightboxScrub}
                style={styles.lightboxScrubTrack}
              >
                <View
                  style={[
                    styles.lightboxScrubProgress,
                    {
                      width: lightboxDuration > 0 ? `${(lightboxTimeCurrent / lightboxDuration) * 100}%` : '0%',
                    },
                  ]}
                />
              </Pressable>

              {/* Controls Row */}
              <View style={styles.lightboxControlsRow}>
                <View style={styles.lightboxControlsLeft}>
                  {/* Play/Pause Button */}
                  <Pressable
                    accessibilityRole="button"
                    aria-label={isLightboxPlaying ? 'Pause video' : 'Play video'}
                    onPress={toggleLightboxPlay}
                    style={({ pressed }) => [styles.lightboxControlBtn, pressed && styles.buttonPressed]}
                  >
                    <Ionicons
                      name={isLightboxPlaying ? 'pause' : 'play'}
                      size={18}
                      color="#FAFAFA"
                      aria-hidden={true}
                    />
                  </Pressable>

                  {/* Volume/Mute Button */}
                  <Pressable
                    accessibilityRole="button"
                    aria-label={isLightboxMuted ? 'Unmute video audio' : 'Mute video audio'}
                    onPress={toggleLightboxMute}
                    style={({ pressed }) => [styles.lightboxControlBtn, pressed && styles.buttonPressed]}
                  >
                    <Ionicons
                      name={isLightboxMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                      size={18}
                      color={isLightboxMuted ? '#71717A' : '#FFFFFF'}
                      aria-hidden={true}
                    />
                  </Pressable>

                  {/* Time Indicator */}
                  <Text style={styles.lightboxTimeText}>
                    {formatVideoTime(lightboxTimeCurrent)}&nbsp;/&nbsp;{formatVideoTime(lightboxDuration || 34)}
                  </Text>
                </View>

                {/* Fullscreen Toggle */}
                {Platform.OS === 'web' && (
                  <Pressable
                    accessibilityRole="button"
                    aria-label="Toggle full screen mode"
                    onPress={toggleLightboxFullscreen}
                    style={({ pressed }) => [styles.lightboxControlBtn, pressed && styles.buttonPressed]}
                  >
                    <Ionicons name="scan-outline" size={17} color="#FAFAFA" aria-hidden={true} />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      )}
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
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'transparent',
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    boxShadow: 'none',
    elevation: 0,
  },
  navSecondaryText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.semibold,
    color: '#FFFFFF',
  },
  navPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    boxShadow: 'none',
    elevation: 0,
  },
  navPrimaryText: {
    color: '#000000',
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
    paddingHorizontal: 48,
    maxWidth: 1800,
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
  releaseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  releaseTagText: {
    fontSize: 11.5,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
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
    maxWidth: 860,
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
    borderRadius: 4,
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    boxShadow: 'none',
    elevation: 0,
  },
  heroDownloadLabels: {
    gap: 2,
  },
  heroDownloadMain: {
    color: '#000000',
    fontSize: 16,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.2,
  },
  heroDownloadMeta: {
    color: '#52525B',
    fontSize: 12.5,
    fontWeight: Typography.weights.medium,
  },
  heroQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'transparent',
    minHeight: 48,
    boxShadow: 'none',
    elevation: 0,
  },
  heroQrText: {
    fontSize: 14.5,
    fontWeight: Typography.weights.semibold,
    color: '#FFFFFF',
  },
  commitmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: Spacing['2xl'],
    paddingTop: Spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxWidth: 920,
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
  /* ── FULL-BLEED HERO STAGE WITH VIDEO BACKGROUND ── */
  heroSectionWrap: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#09090B',
    minHeight: 700,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSectionWrapDesktop: {
    minHeight: 880,
  },
  heroBackgroundVideoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    zIndex: 0,
  },
  heroOverlayContainer: {
    width: '100%',
    maxWidth: 1800,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    zIndex: 10,
    position: 'relative',
    justifyContent: 'center',
  },
  heroOverlayContainerDesktop: {
    paddingHorizontal: 56,
    paddingTop: 100,
    paddingBottom: 130,
    minHeight: 880,
  },
  heroContentWrap: {
    width: '100%',
    zIndex: 10,
  },
  heroContentWrapDesktop: {
    maxWidth: 980,
  },
  heroSpeakerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'transparent',
    minHeight: 48,
    minWidth: 48,
    boxShadow: 'none',
    elevation: 0,
  },
  heroSpeakerText: {
    fontSize: 14,
    fontWeight: Typography.weights.semibold,
  },
  heroFallbackImage: {
    width: '100%',
    height: '100%',
  },
  /* ── EXPANDING PROMOTIONAL VIDEO SHOWCASE ── */
  promoSectionWrap: {
    width: '100%',
    maxWidth: 1720,
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: Spacing['2xl'],
    paddingTop: Spacing.md,
    paddingBottom: Spacing['4xl'],
  },
  promoSectionWrapDesktop: {
    marginTop: 40,
    paddingTop: 20,
    paddingBottom: 80,
    maxWidth: 1720,
  },
  promoHeaderBlock: {
    width: '100%',
    maxWidth: 820,
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: Spacing['3xl'],
  },
  promoEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  promoPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  promoEyebrowText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.2,
  },
  promoMainTitle: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.8,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  promoMainTitleMobile: {
    fontSize: 26,
    lineHeight: 33,
    letterSpacing: -0.4,
  },
  promoSubtitle: {
    fontSize: 16.5,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 720,
    marginBottom: Spacing.lg,
  },
  promoStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  promoStatusText: {
    fontSize: 12,
    fontWeight: Typography.weights.semibold,
    letterSpacing: 0.6,
  },
  promoScrollTrack: {
    width: '100%',
    position: 'relative',
  },
  promoStickyViewport: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoVideoCard: {
    position: 'relative',
    backgroundColor: '#09090B',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: 'rgba(255, 255, 255, 0.32)',
    borderWidth: 1.5,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 1600,
    padding: 0,
  },
  promoCursorBadge: {
    position: 'absolute',
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    boxShadow: 'none',
  },
  promoCursorBadgeText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.8,
  },
  lightboxBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.90)',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  lightboxCard: {
    width: '100%',
    maxWidth: 1200,
    borderRadius: Radius.xl,
    backgroundColor: '#09090B',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 40,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxVideoArea: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  lightboxControlBar: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#101014',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.10)',
    flexDirection: 'column',
    gap: 12,
  },
  lightboxScrubTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    overflow: 'hidden',
    position: 'relative',
  },
  lightboxScrubProgress: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  lightboxControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lightboxControlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lightboxControlBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxTimeText: {
    fontSize: 12.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#FAFAFA',
    fontWeight: Typography.weights.medium,
  },
  promoScreenArea: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  promoNativeFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'left',
  },

  /* ── DOWNLOAD HUB SECTION (FLAT ARCHITECTURE - ZERO CARD CONTAINERS) ── */
  downloadHubSection: {
    width: '100%',
    maxWidth: 1720,
    alignSelf: 'center',
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing['3xl'],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 64,
  },
  downloadHubLeft: {
    flex: 1.25,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.9,
    color: '#FFFFFF',
  },
  hubTitle: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.8,
    marginBottom: 8,
    color: '#FFFFFF',
  },
  hubSubtitle: {
    fontSize: 15.5,
    lineHeight: 24,
    color: '#A1A1AA',
    marginBottom: Spacing.xl,
  },
  flatSpecsList: {
    width: '100%',
    marginBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  flatSpecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  flatSpecLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1.2,
    color: '#71717A',
  },
  flatSpecValue: {
    fontSize: 14.5,
    fontWeight: Typography.weights.medium,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  bigDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 4,
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    elevation: 0,
    boxShadow: 'none',
    alignSelf: 'flex-start',
  },
  bigDownloadTextCol: {
    gap: 2,
  },
  bigDownloadTitle: {
    color: '#000000',
    fontSize: 16.5,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.2,
  },
  bigDownloadSub: {
    color: '#52525B',
    fontSize: 12.5,
    fontWeight: Typography.weights.medium,
  },
  checksumSection: {
    marginTop: Spacing.lg,
  },
  checksumToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    minHeight: 44,
    minWidth: 44,
  },
  checksumToggleText: {
    fontSize: 13,
    fontWeight: Typography.weights.medium,
    color: '#A1A1AA',
  },
  flatShaBlock: {
    marginTop: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  shaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  shaTitle: {
    fontSize: 10.5,
    fontWeight: Typography.weights.bold,
    letterSpacing: 1,
    color: '#71717A',
  },
  shaCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'transparent',
  },
  shaCopyText: {
    fontSize: 11.5,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
  },
  shaHashString: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#E4E4E7',
  },
  terminalHelperCode: {
    fontSize: 11.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#71717A',
  },
  downloadHubRight: {
    flex: 0.85,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  flatQrColumn: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 14,
  },
  qrHeading: {
    fontSize: 20,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.4,
    color: '#FFFFFF',
  },
  qrInstructions: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#A1A1AA',
  },
  flatQrImage: {
    width: 200,
    height: 200,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  qrHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qrHelperText: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: Typography.weights.medium,
  },

  /* ── INSTALLATION GUIDE (FLAT OPEN SETUP MANUAL - ZERO CARD CONTAINERS) ── */
  guideContainer: {
    width: '100%',
    maxWidth: 1720,
    alignSelf: 'center',
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing['4xl'],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: Spacing['2xl'],
  },
  guideContainerMobile: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  guideHeaderGroup: {
    marginBottom: Spacing.md,
  },
  guideMainTitle: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    letterSpacing: -0.6,
    marginBottom: 6,
    color: '#FFFFFF',
  },
  guideSubtitle: {
    fontSize: 15.5,
    color: '#A1A1AA',
    lineHeight: 23,
  },
  flatPlatformTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  flatTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'transparent',
    minHeight: 40,
    justifyContent: 'center',
  },
  flatTabBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  flatTabText: {
    fontSize: 13,
    fontWeight: Typography.weights.semibold,
    color: '#A1A1AA',
  },
  flatTabTextActive: {
    color: '#000000',
    fontWeight: Typography.weights.bold,
  },
  flatStepList: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  flatStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  flatStepIndex: {
    fontSize: 13,
    fontWeight: Typography.weights.bold,
    color: '#71717A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
    minWidth: 28,
    paddingTop: 3,
  },
  flatStepBodyCol: {
    flex: 1,
    gap: 6,
  },
  flatStepTitle: {
    fontSize: 16.5,
    fontWeight: Typography.weights.bold,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  flatStepText: {
    fontSize: 14.5,
    lineHeight: 23,
    color: '#A1A1AA',
  },
  inlineKbd: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  flatCredibilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  flatCredibilityText: {
    fontSize: 13.5,
    lineHeight: 22,
    color: '#A1A1AA',
    flex: 1,
  },

  /* ── FOOTER ── */
  footerOuter: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#FFFFFF',
  },
  footerCopyright: {
    fontSize: 13,
    textAlign: 'center',
    color: '#71717A',
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
    color: '#FFFFFF',
  },
});
