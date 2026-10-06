import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { ForumThread, ForumComment } from '../api/community';

/**
 * Insert a row carrying the new avatar/attachment columns, retrying with the
 * legacy column set when the DB hasn't run the migration yet — so sync keeps
 * working on both old and new databases.
 */
async function insertWithFallback(
  table: string,
  full: Record<string, unknown>,
  minimal: Record<string, unknown>
) {
  try {
    const { error } = await supabase.from(table).insert([full]);
    if (error) throw error;
  } catch {
    try {
      await supabase.from(table).insert([minimal]);
    } catch {
      // Bypassed if table not initialized
    }
  }
}

interface CommunityState {
  userThreads: ForumThread[];
  threadReplies: Record<string, ForumComment[]>;
  createThread: (params: { title: string; category: string; body: string; author: string; imageUrls?: string[]; authorAvatarUrl?: string }) => Promise<ForumThread>;
  deleteThread: (threadId: string) => void;
  addReply: (params: { threadId: string; body: string; author: string; imageUrls?: string[]; replyTo?: string; avatarUrl?: string }) => Promise<ForumComment>;
  deleteReply: (threadId: string, replyId: string) => void;
  likeThread: (threadId: string) => void;
  likeReply: (threadId: string, replyId: string) => void;
}

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, get) => ({
      userThreads: [],
      threadReplies: {},

      createThread: async ({ title, category, body, author, imageUrls, authorAvatarUrl }) => {
        const newThread: ForumThread = {
          id: `custom_${Date.now()}`,
          title: title.trim(),
          category: category.trim(),
          author: author.trim() || 'Anonymous Reader',
          authorAvatarUrl: authorAvatarUrl || undefined,
          repliesCount: 1,
          createdAt: new Date().toISOString(),
          lastReplyAt: new Date().toISOString(),
          imageUrls: imageUrls && imageUrls.length > 0 ? imageUrls : undefined,
        };

        const initialReply: ForumComment = {
          id: `reply_${Date.now()}`,
          username: author.trim() || 'Anonymous Reader',
          avatarUrl: authorAvatarUrl || undefined,
          postedAt: new Date().toISOString(),
          body: body.trim(),
          likes: 1,
          imageUrls: imageUrls && imageUrls.length > 0 ? [...imageUrls] : undefined,
        };

        // Try syncing to Supabase community_threads if available
        await insertWithFallback(
          'community_threads',
          {
            id: newThread.id,
            title: newThread.title,
            category: newThread.category,
            author: newThread.author,
            body: body.trim(),
            author_avatar_url: newThread.authorAvatarUrl ?? null,
            image_urls: newThread.imageUrls ?? null,
          },
          {
            id: newThread.id,
            title: newThread.title,
            category: newThread.category,
            author: newThread.author,
            body: body.trim(),
          }
        );

        set((state) => ({
          userThreads: [newThread, ...state.userThreads],
          threadReplies: {
            ...state.threadReplies,
            [newThread.id]: [initialReply],
          },
        }));

        return newThread;
      },

      deleteThread: (threadId: string) => {
        try {
          supabase.from('community_threads').delete().eq('id', threadId).then();
        } catch {}

        set((state) => {
          const updatedThreads = state.userThreads.filter((t) => t.id !== threadId);
          const updatedReplies = { ...state.threadReplies };
          delete updatedReplies[threadId];
          return {
            userThreads: updatedThreads,
            threadReplies: updatedReplies,
          };
        });
      },

      addReply: async ({ threadId, body, author, imageUrls, replyTo, avatarUrl }) => {
        const replyObj: ForumComment = {
          id: `reply_${Date.now()}`,
          username: author.trim() || 'Yomite Reader',
          avatarUrl: avatarUrl || undefined,
          postedAt: new Date().toISOString(),
          body: body.trim(),
          likes: 1,
          imageUrls: imageUrls && imageUrls.length > 0 ? [...imageUrls] : undefined,
          replyTo: replyTo?.trim() ? replyTo.trim() : undefined,
        };

        // Try syncing to Supabase thread_replies if available
        await insertWithFallback(
          'thread_replies',
          {
            thread_id: threadId,
            username: replyObj.username,
            body: replyObj.body,
            avatar_url: replyObj.avatarUrl ?? null,
            image_urls: replyObj.imageUrls ?? null,
            reply_to: replyObj.replyTo ?? null,
          },
          {
            thread_id: threadId,
            username: replyObj.username,
            body: replyObj.body,
          }
        );

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

      deleteReply: (threadId: string, replyId: string) => {
        try {
          supabase.from('thread_replies').delete().eq('id', replyId).then();
        } catch {}

        set((state) => {
          const currentReplies = state.threadReplies[threadId] || [];
          const updatedReplies = currentReplies.filter((r) => r.id !== replyId);
          const updatedUserThreads = state.userThreads.map((t) =>
            t.id === threadId
              ? { ...t, repliesCount: Math.max(0, t.repliesCount - 1) }
              : t
          );

          return {
            userThreads: updatedUserThreads,
            threadReplies: {
              ...state.threadReplies,
              [threadId]: updatedReplies,
            },
          };
        });
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
