/**
 * Not Found Screen
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography } from '../constants/Colors';

import { Ionicons } from '@expo/vector-icons';

export default function NotFoundScreen() {
  const router = useRouter();
  const colors = Colors.dark;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.text }]}>Page Not Found</Text>
      <Pressable
        onPress={() => router.replace('/(tabs)' as any)}
        style={[styles.button, { backgroundColor: colors.accent }]}
      >
        <Text style={styles.buttonText}>Go Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  title: {
    fontSize: Typography.sizes.title2,
    fontWeight: Typography.weights.bold,
  },
  button: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: Typography.sizes.body,
  },
});
