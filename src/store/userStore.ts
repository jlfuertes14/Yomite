/**
 * User Store — Handles Supabase User Authentication, Session State & Google Auth
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { createURL, parse } from 'expo-linking';

interface UserState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  initializeAuth: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  session: null,
  isLoading: true,

  initializeAuth: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      set({ session: data.session, user: data.session?.user ?? null, isLoading: false });

      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null, isLoading: false });
      });
    } catch (err) {
      set({ isLoading: false });
    }
  },

  signUpWithEmail: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data.session) {
      set({ session: data.session, user: data.user });
    }
    return { error };
  },

  signInWithEmail: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session) {
      set({ session: data.session, user: data.user });
    }
    return { error };
  },

  signInWithGoogle: async () => {
    try {
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

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));
