/**
 * Extensions / Sources Screen — Modern Minimalist Theme
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography } from '../../constants/Colors';
import { parseMangaDexUrl } from '../../src/api/mangadex';

export default function ExtensionsScreen() {
  const router = useRouter();
  const colors = Colors.dark;
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadUrl = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    const parsed = parseMangaDexUrl(trimmed);
    if (!parsed) {
      Alert.alert(
        'Invalid URL',
        'Please enter a valid MangaDex title or chapter URL.\n\nExample:\nhttps://mangadex.org/title/...\nhttps://mangadex.org/chapter/...'
      );
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
      Alert.alert('Error', 'Failed to load the manga. Please check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [url, router]);

  const sources = [
    {
      id: 'mangadex',
      name: 'MangaDex API v5',
      desc: 'Official MangaDex API source',
      icon: 'library-outline' as const,
      enabled: true,
      builtIn: true,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Sources</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* URL Loader Section */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="link-outline" size={18} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Open by MangaDex URL
            </Text>
          </View>
          <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
            Paste a MangaDex title or chapter link to open it directly in the app
          </Text>

          <View style={[styles.urlInputRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <TextInput
              style={[styles.urlInput, { color: colors.text }]}
              placeholder="https://mangadex.org/title/..."
              placeholderTextColor={colors.textMuted}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleLoadUrl}
            />
            <Pressable
              onPress={handleLoadUrl}
              disabled={isLoading || !url.trim()}
              style={[
                styles.goButton,
                {
                  backgroundColor: url.trim() ? colors.accent : colors.surfaceElevated,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Sources List */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          Installed Sources
        </Text>
        {sources.map((source) => (
          <View
            key={source.id}
            style={[styles.sourceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.sourceIconBox, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name={source.icon} size={20} color={colors.text} />
            </View>
            <View style={styles.sourceInfo}>
              <Text style={[styles.sourceName, { color: colors.text }]}>
                {source.name}
              </Text>
              <Text style={[styles.sourceDesc, { color: colors.textMuted }]}>
                {source.desc}
              </Text>
            </View>
            <View
              style={[
                styles.enabledBadge,
                { backgroundColor: colors.emeraldSubtle, borderColor: 'rgba(16,185,129,0.3)' },
              ]}
            >
              <Text
                style={{
                  color: colors.emerald,
                  fontSize: 11,
                  fontWeight: '600',
                }}
              >
                Active
              </Text>
            </View>
          </View>
        ))}

        {/* Add Custom Source */}
        <Pressable
          style={[styles.addSourceButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Ionicons name="add" size={18} color={colors.textSecondary} />
          <Text style={[styles.addSourceText, { color: colors.textSecondary }]}>
            Add Custom Source
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  title: {
    fontSize: Typography.sizes.title1,
    fontWeight: Typography.weights.bold,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    fontSize: Typography.sizes.callout,
    fontWeight: Typography.weights.semibold,
  },
  cardDesc: {
    fontSize: Typography.sizes.footnote,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingLeft: Spacing.md,
    gap: Spacing.sm,
  },
  urlInput: {
    flex: 1,
    fontSize: Typography.sizes.body,
    paddingVertical: Spacing.md - 2,
  },
  goButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  sectionLabel: {
    fontSize: Typography.sizes.callout,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.xs,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  sourceIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceInfo: { flex: 1 },
  sourceName: {
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  sourceDesc: {
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
  enabledBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  addSourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addSourceText: {
    fontSize: Typography.sizes.footnote,
    fontWeight: Typography.weights.medium,
  },
});
