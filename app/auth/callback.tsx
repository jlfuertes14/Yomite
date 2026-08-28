import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { supabase } from '../../src/lib/supabase';
import { useUserStore } from '../../src/store/userStore';
import { syncUserDataWithCloud } from '../../src/services/cloudSync';
import { useThemeColors } from '../../src/hooks/useThemeColor';
import { useDocumentTitle } from '../../src/utils/useDocumentTitle';

export default function AuthCallbackScreen() {
  useDocumentTitle('Authenticating');
  const router = useRouter();
  const colors = useThemeColors();
  const [statusText, setStatusText] = useState('Authenticating with Yomite...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function handleAuthCallback() {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hash = window.location.hash;
          const search = window.location.search;
          const searchParams = new URLSearchParams(search);
          const hashParams = new URLSearchParams(hash.replace(/^#/, ''));

          // Check if there was an OAuth error
          const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');
          if (errorDesc) {
            if (mounted) setErrorMessage(decodeURIComponent(errorDesc));
            return;
          }

          // Check for PKCE authorization code (?code=...)
          const code = searchParams.get('code');
          if (code) {
            setStatusText('Exchanging authorization code...');
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              if (mounted) setErrorMessage(error.message);
              return;
            }
            if (data?.user?.id) {
              await syncUserDataWithCloud(data.user.id);
              await useUserStore.getState().refreshUser();
            }
            if (mounted) router.replace('/(tabs)' as any);
            return;
          }

          // Check for implicit flow tokens (#access_token=...&refresh_token=...)
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            setStatusText('Restoring session...');
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) {
              if (mounted) setErrorMessage(error.message);
              return;
            }
            if (data?.user?.id) {
              await syncUserDataWithCloud(data.user.id);
              await useUserStore.getState().refreshUser();
            }
            if (mounted) router.replace('/(tabs)' as any);
            return;
          }
        }

        // Fallback: Check existing Supabase session
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          await syncUserDataWithCloud(data.session.user.id);
          await useUserStore.getState().refreshUser();
          if (mounted) router.replace('/(tabs)' as any);
        } else {
          // Wait briefly for onAuthStateChange listener to resolve
          const timeout = setTimeout(() => {
            if (mounted) router.replace('/(tabs)' as any);
          }, 2000);
          return () => clearTimeout(timeout);
        }
      } catch (err: any) {
        if (mounted) setErrorMessage(err?.message || 'Authentication failed');
      }
    }

    handleAuthCallback();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Image
          source={require('../../assets/images/mascot.png')}
          style={styles.mascot}
          contentFit="contain"
        />
        <Text style={[styles.title, { color: colors.text }]}>Yomite Auth</Text>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              onPress={() => router.replace('/(tabs)' as any)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.returnLink, { color: colors.accent }]}>
                Return to Home
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {statusText}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    elevation: 8,
  },
  mascot: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: '#F43F5E',
    fontSize: 14,
    textAlign: 'center',
  },
  returnLink: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginTop: 8,
  },
});
