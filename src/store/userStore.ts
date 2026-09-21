import { Platform, NativeModules, TurboModuleRegistry } from 'react-native';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createURL, parse } from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { syncUserDataWithCloud } from '../services/cloudSync';

let GoogleSigninModule: any = null;
let googleSigninConfigured = false;

/**
 * Safely access @react-native-google-signin/google-signin only when its native binary
 * module (RNGoogleSignin) exists in the runtime environment.
 * This prevents Expo Go from throwing:
 * "TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found"
 */
function getNativeGoogleSignin() {
  if (Platform.OS === 'web') return null;
  if (GoogleSigninModule) return GoogleSigninModule;

  const isAvailable =
    (typeof TurboModuleRegistry !== 'undefined' &&
      typeof TurboModuleRegistry.get === 'function' &&
      TurboModuleRegistry.get('RNGoogleSignin') != null) ||
    (typeof NativeModules !== 'undefined' &&
      NativeModules?.RNGoogleSignin != null);

  if (!isAvailable) {
    return null;
  }

  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    if (GoogleSignin && !googleSigninConfigured) {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (webClientId) {
        GoogleSignin.configure({
          webClientId,
          offlineAccess: false,
        });
      }
      googleSigninConfigured = true;
    }
    GoogleSigninModule = GoogleSignin;
    return GoogleSigninModule;
  } catch (err) {
    console.warn('[userStore] Native GoogleSignin module could not be loaded:', err);
    return null;
  }
}

export interface UserProfileData {
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

interface UserState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  authSuccessMessage: string | null;
  clearAuthSuccessMessage: () => void;
  initializeAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, username?: string) => Promise<{ error: any; user?: User | null; session?: Session | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  updateProfile: (data: UserProfileData) => Promise<{ data?: User | null; error: any }>;
  signOut: () => Promise<void>;
}

/**
 * Clean helper function to get preferred display name or fallback
 */
export function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return 'Guest';
  const meta = user.user_metadata || {};
  return (
    meta.display_name ||
    meta.username ||
    meta.full_name ||
    meta.name ||
    (user.email ? user.email.split('@')[0] : 'Yomite Reader')
  );
}

/**
 * Clean helper function to get username handle (e.g. "otaku99")
 */
export function getUserHandle(user: User | null | undefined): string {
  if (!user) return 'guest';
  const meta = user.user_metadata || {};
  const name = meta.username || meta.display_name || (user.email ? user.email.split('@')[0] : 'reader');
  return name.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Clean helper function to get user avatar URL or null
 */
export function getUserAvatarUrl(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const url = meta.avatar_url || meta.picture || meta.avatar || (user as any).avatar_url || null;
  if (!url || typeof url !== 'string' || url.trim().length === 0) return null;
  return url.trim();
}

let isAuthInitialized = false;
let authListenerSubscription: any = null;
let deepLinkSubscription: any = null;

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  authSuccessMessage: null,
  clearAuthSuccessMessage: () => set({ authSuccessMessage: null }),

  initializeAuth: async () => {
    if (isAuthInitialized) {
      get().refreshUser();
      return;
    }
    isAuthInitialized = true;

    try {
      // 1. On Web: Parse incoming URL hash or search params for OAuth / email confirmation tokens
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        const search = window.location.search;
        const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
        const searchParams = new URLSearchParams(search);

        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const code = searchParams.get('code') || hashParams.get('code');
        const authType = hashParams.get('type') || searchParams.get('type');

        if (code) {
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && data?.session) {
              set({
                session: data.session,
                user: data.user,
                isLoading: false,
                authSuccessMessage:
                  authType === 'signup' || authType === 'email'
                    ? '🎉 Email confirmed! Welcome to Yomite.'
                    : 'Signed in successfully.',
              });
              if (data.user?.id) syncUserDataWithCloud(data.user.id);
            }
          } catch (_e) {}
          window.history.replaceState(null, '', window.location.pathname);
        } else if (accessToken && refreshToken) {
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!error && data?.session) {
              set({
                session: data.session,
                user: data.user,
                isLoading: false,
                authSuccessMessage:
                  authType === 'signup' || authType === 'email'
                    ? '🎉 Email confirmed! Welcome to Yomite.'
                    : 'Signed in successfully.',
              });
              if (data.user?.id) syncUserDataWithCloud(data.user.id);
            }
          } catch (_e) {}
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      // 2. On Native (Android / iOS): Listen for incoming OAuth deep links
      if (Platform.OS !== 'web') {
        const processDeepLink = async (urlStr: string) => {
          if (!urlStr) return;
          if (urlStr.includes('access_token') || urlStr.includes('refresh_token')) {
            let accessToken: string | undefined;
            let refreshToken: string | undefined;

            if (urlStr.includes('#')) {
              const hashParts = urlStr.split('#')[1];
              const params = new URLSearchParams(hashParts);
              accessToken = params.get('access_token') || undefined;
              refreshToken = params.get('refresh_token') || undefined;
            }

            if (!accessToken || !refreshToken) {
              const parsed = parse(urlStr);
              accessToken = parsed.queryParams?.access_token as string;
              refreshToken = parsed.queryParams?.refresh_token as string;
            }

            if (accessToken && refreshToken) {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (!error && data?.session) {
                set({
                  session: data.session,
                  user: data.user,
                  isLoading: false,
                  authSuccessMessage: '🎉 Signed in with Google!',
                });
                if (data.user?.id) syncUserDataWithCloud(data.user.id);
              }
            }
          }
        };

        // Check if app was launched via deep link
        Linking.getInitialURL().then((url) => {
          if (url) processDeepLink(url);
        });

        // Listen for foreground deep links while app is running
        if (deepLinkSubscription) {
          deepLinkSubscription.remove();
        }
        deepLinkSubscription = Linking.addEventListener('url', (event) => {
          if (event.url) processDeepLink(event.url);
        });
      }

      const { data } = await supabase.auth.getSession();
      const session = data?.session ?? null;
      set({ session, user: session?.user ?? null, isLoading: false });

      if (session?.user?.id) {
        // Fetch fresh user record from server to ensure metadata like avatar_url is in sync
        const { data: freshUser } = await supabase.auth.getUser();
        if (freshUser?.user) {
          set({ user: freshUser.user });
        }
        syncUserDataWithCloud(session.user.id);
      }

      if (authListenerSubscription) {
        authListenerSubscription.unsubscribe();
      }

      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        set({ session: newSession, user: newSession?.user ?? null, isLoading: false });
        if (newSession?.user?.id && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED')) {
          const { data: freshUser } = await supabase.auth.getUser();
          if (freshUser?.user) {
            set({ user: freshUser.user });
          }
          syncUserDataWithCloud(newSession.user.id);
        }
      });
      authListenerSubscription = authListener.subscription;
    } catch (err) {
      set({ isLoading: false });
    }
  },

  refreshUser: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        set({ user: data.user });
      }
    } catch (err) {
      // Ignore
    }
  },

  signUpWithEmail: async (email, password, username) => {
    try {
      const cleanUsername = username?.trim() || email.split('@')[0];
      const redirectUri = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? window.location.origin : 'https://yomite.vercel.app')
        : createURL('auth/callback');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUri,
          data: {
            username: cleanUsername,
            display_name: cleanUsername,
          },
        },
      });

      if (!error && data.session) {
        set({ session: data.session, user: data.user });
        if (data.user?.id) syncUserDataWithCloud(data.user.id);
      }
      return { error, user: data?.user, session: data?.session };
    } catch (err: any) {
      console.error('Sign up error:', err);
      return { error: { message: err?.message || 'Sign up failed. Please check your network connection.' } };
    }
  },

  signInWithEmail: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.session) {
        set({ session: data.session, user: data.user });
        if (data.user?.id) syncUserDataWithCloud(data.user.id);
      }
      return { error };
    } catch (err: any) {
      console.error('Sign in error:', err);
      return { error: { message: err?.message || 'Sign in failed. Please check your network connection.' } };
    }
  },

  signInWithGoogle: async () => {
    try {
      const nativeGoogleSignin = getNativeGoogleSignin();

      if (nativeGoogleSignin) {
        // Native iOS & Android with custom dev client or standalone APK:
        // Use native Google Sign-In SDK (no browser)
        const response = await nativeGoogleSignin.signIn();
        const idToken = response?.data?.idToken;

        if (!idToken) {
          return { error: { message: 'Google Sign-In failed: no ID token received.' } };
        }

        // Exchange the native ID token with Supabase for a session
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });

        if (!error && data?.session) {
          set({
            session: data.session,
            user: data.user,
            authSuccessMessage: '🎉 Signed in with Google!',
          });
          if (data.user?.id) syncUserDataWithCloud(data.user.id);
        }

        return { error: error || null };
      }

      // Web or Expo Go (where RNGoogleSignin native binary module is not present):
      // Use Supabase OAuth flow via browser or Expo WebBrowser
      const redirectUri = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? window.location.origin : 'https://yomite.vercel.app')
        : createURL('auth/callback');

      if (Platform.OS === 'web') {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: false,
          },
        });
        return { error };
      } else {
        // Mobile Expo Go fallback: use Supabase OAuth with openAuthSessionAsync
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true,
          },
        });

        if (error || !data?.url) {
          return { error: error || { message: 'Failed to generate Google Sign-In URL' } };
        }

        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (res.type === 'success' && res.url) {
          const parsed = parse(res.url);
          const accessToken = parsed.queryParams?.access_token as string;
          const refreshToken = parsed.queryParams?.refresh_token as string;
          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!sessionErr && sessionData?.session) {
              set({
                session: sessionData.session,
                user: sessionData.user,
                authSuccessMessage: '🎉 Signed in with Google!',
              });
              if (sessionData.user?.id) syncUserDataWithCloud(sessionData.user.id);
            }
            return { error: sessionErr };
          }
        }
        return { error: null };
      }
    } catch (err: any) {
      if (err?.code === 'SIGN_IN_CANCELLED') {
        return { error: null };
      }
      return { error: err };
    }
  },

  updateProfile: async (profileData) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: profileData,
      });

      if (!error && data?.user) {
        set({ user: data.user });
        syncUserDataWithCloud(data.user.id);
      }
      return { data: data?.user, error };
    } catch (err: any) {
      return { error: err };
    }
  },

  signOut: async () => {
    try {
      const nativeGoogleSignin = getNativeGoogleSignin();
      if (nativeGoogleSignin) {
        await nativeGoogleSignin.signOut().catch(() => {});
      }
    } catch (_) {}
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));
