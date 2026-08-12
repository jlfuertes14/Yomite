import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { ForumThread, ForumComment } from '../api/community';

interface CommunityState {
  userThreads: ForumThread[];
  threadReplies: Record<string, ForumComment[]>;
  createThread: (params: { title: string; category: string; body: string; author: string }) => Promise<ForumThread>;
  addReply: (params: { threadId: string; body: string; author: string }) => Promise<ForumComment>;
  likeThread: (threadId: string) => void;
  likeReply: (threadId: string, replyId: string) => void;
}

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, get) => ({
      userThreads: [],
      threadReplies: {},

      createThread: async ({ title, category, body, author }) => {
        const newThread: ForumThread = {
          id: `custom_${Date.now()}`,
          title: title.trim(),
          category: category.trim(),
          author: author.trim() || 'Anonymous Reader',
          repliesCount: 1,
          createdAt: new Date().toISOString(),
          lastReplyAt: new Date().toISOString(),
        };

        const initialReply: ForumComment = {
          id: `reply_${Date.now()}`,
          username: author.trim() || 'Anonymous Reader',
          postedAt: new Date().toISOString(),
          body: body.trim(),
          likes: 1,
        };

        // Try syncing to Supabase community_threads if available
        try {
          await supabase.from('community_threads').insert([
            {
              id: newThread.id,
              title: newThread.title,
              category: newThread.category,
              author: newThread.author,
              body: body.trim(),
            },
          ]);
        } catch (err) {
          // Bypassed if table not initialized
        }

        set((state) => ({
          userThreads: [newThread, ...state.userThreads],
          threadReplies: {
            ...state.threadReplies,
            [newThread.id]: [initialReply],
          },
        }));

        return newThread;
      },

      addReply: async ({ threadId, body, author }) => {
        const replyObj: ForumComment = {
          id: `reply_${Date.now()}`,
          username: author.trim() || 'Yomite Reader',
          postedAt: new Date().toISOString(),
          body: body.trim(),
          likes: 1,
        };

        // Try syncing to Supabase thread_replies if available
        try {
          await supabase.from('thread_replies').insert([
            {
              thread_id: threadId,
              username: replyObj.username,
              body: replyObj.body,
            },
          ]);
        } catch (err) {
          // Bypassed if table not initialized
        }

        set((state) => {
          const currentReplies = state.threadReplies[threadId] || [];
          const updatedUserThreads = state.userThreads.map((t) =>
            t.id === threadId
              ? { ...t, repliesCount: t.repliesCount + 1, lastReplyAt: new Date().toISOString() }
              : t
          );

          return {
            userThreads: updatedUserThreads,
            threadReplies: {
              ...state.threadReplies,
              [threadId]: [...currentReplies, replyObj],
            },
          };
        });

        return replyObj;
      },

      likeThread: (threadId) => {
        set((state) => ({
          userThreads: state.userThreads.map((t) =>
            t.id === threadId ? { ...t, repliesCount: t.repliesCount + 1 } : t
          ),
        }));
      },

      likeReply: (threadId, replyId) => {
        set((state) => {
          const currentReplies = state.threadReplies[threadId] || [];
          const updated = currentReplies.map((r) =>
            r.id === replyId ? { ...r, likes: r.likes + 1 } : r
          );
          return {
            threadReplies: {
              ...state.threadReplies,
              [threadId]: updated,
            },
          };
        });
      },
    }),
    {
      name: 'yomite-community-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
