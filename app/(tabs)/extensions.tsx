import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { parseMangaDexUrl } from '../../src/api/mangadex';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';
import { AnimatedCard } from '../../src/components/AnimatedCard';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';

export default function ExtensionsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Custom Confirmation Dialog State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    iconName?: keyof typeof Ionicons.glyphMap;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'destructive' | 'primary' | 'success';
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleLoadUrl = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    const parsed = parseMangaDexUrl(trimmed);
    if (!parsed) {
      setConfirmModalConfig({
        visible: true,
        title: 'Invalid URL Format',
        message: 'Please enter a valid MangaDex title or chapter link.\n\nExample:\nhttps://mangadex.org/title/...\nhttps://mangadex.org/chapter/...',
        iconName: 'link-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsLoading(true);
    try {
      if (parsed.type === 'title') {
        router.push(`/manga/${parsed.id}` as any);
      } else {
        router.push(`/reader/${parsed.id}` as any);
      }
      setUrl('');
    } catch (err) {
      setConfirmModalConfig({
        visible: true,
        title: 'Load Failed',
        message: 'Failed to load the specified manga URL. Please check the link and try again.',
        iconName: 'alert-circle-outline',
        confirmText: 'OK',
        cancelText: '',
        confirmVariant: 'primary',
        onConfirm: () => setConfirmModalConfig((prev) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsLoading(false);
    }
  }, [url, router]);

  const sources = [
    {
      id: 'mangadex',
      name: 'MangaDex',
      version: 'v2.4.0',
      lang: 'Multi (EN, JP, ES, FR...)',
      status: 'Active',
      icon: 'globe-outline' as const,
      description: 'Official API integration with high quality scans and community translations.',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[{ flex: 1, width: '100%' }, Platform.OS === 'web' && styles.webCenteredContent]}>
        <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          {Platform.OS === 'web' && (
            <Pressable
              onPress={() => setDrawerVisible(true)}
              style={({ pressed }) => [styles.plainIconButton, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={8}
            >
              <Ionicons name="menu" size={26} color={colors.text} />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Extensions & Sources</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Manage content sources and open external MangaDex URLs directly
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Open Direct URL Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Open MangaDex URL directly
          </Text>
          <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
            Paste any title or chapter URL to open it directly in Yomite:
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.urlInput,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="https://mangadex.org/title/..."
              placeholderTextColor={colors.textMuted}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <AnimatedPressable
              onPress={handleLoadUrl}
              disabled={isLoading || !url.trim()}
              style={[
                styles.loadBtn,
                {
                  backgroundColor: colors.accent,
                  opacity: url.trim() ? 1 : 0.5,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.loadBtnText}>Open</Text>
              )}
            </AnimatedPressable>
          </View>
        </View>

        {/* Installed Sources Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          Installed Source Extensions
        </Text>

        {sources.map((source, index) => (
          <AnimatedCard
            key={source.id}
            index={index}
            style={[styles.sourceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.sourceTop}>
              <View style={[styles.sourceIconBox, { backgroundColor: `${colors.accent}1F` }]}>
                <Ionicons name={source.icon} size={22} color={colors.accent} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.sourceTitleRow}>
                  <Text style={[styles.sourceName, { color: colors.text }]}>{source.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.emerald }]}>
                      ● {source.status}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.sourceMeta, { color: colors.textMuted }]}>
                  {source.version} · {source.lang}
                </Text>
              </View>
            </View>

            <Text style={[styles.sourceDesc, { color: colors.textSecondary }]}>
              {source.description}
            </Text>
          </AnimatedCard>
        ))}
      </ScrollView>

      {/* Sleek Custom Confirmation Dialog */}
      <ConfirmationModal
        visible={confirmModalConfig.visible}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        iconName={confirmModalConfig.iconName || 'information-circle-outline'}
        confirmVariant={confirmModalConfig.confirmVariant || 'primary'}
        confirmText={confirmModalConfig.confirmText || 'OK'}
        cancelText={confirmModalConfig.cancelText}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, visible: false }))}
      />

      {/* Hamburger Slide Drawer */}
      <SidebarDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webCenteredContent: {
    maxWidth: 1400,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  plainIconButton: {
    padding: 4,
  },
  title: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  subtitle: {
    fontSize: Typography.sizes.footnote,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  cardTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  cardDesc: {
    fontSize: Typography.sizes.caption,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  urlInput: {
    flex: 1,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.footnote,
  },
  loadBtn: {
    height: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
  },
  sectionHeading: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
  },
  sourceCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  sourceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sourceIconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceName: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.bold,
  },
  statusBadge: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: Typography.weights.bold,
  },
  sourceMeta: {
    fontSize: Typography.sizes.caption,
  },
  sourceDesc: {
    fontSize: Typography.sizes.footnote,
    lineHeight: 18,
  },
});
