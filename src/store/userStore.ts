import { Platform } from 'react-native';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { createURL, parse } from 'expo-linking';

import { syncUserDataWithCloud } from '../services/cloudSync';

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
        ? (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'https://yomite.vercel.app/auth/callback')
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
      if (Platform.OS === 'web') {
        const redirectUri = typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : 'https://yomite.vercel.app/auth/callback';

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: false,
          },
        });
        return { error };
      }

      // Native iOS & Android flow with WebBrowser auth session
      const redirectUri = createURL('auth/callback');
      console.log('Google Auth Redirect URI:', redirectUri);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) return { error };

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'success' && result.url) {
          const urlStr = result.url;
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
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      }
      return { error: null };
    } catch (err: any) {
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
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));
