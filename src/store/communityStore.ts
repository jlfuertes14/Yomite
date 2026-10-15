import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { ForumThread, ForumComment } from '../api/community';
import { uploadCommunityImages } from '../services/communityMediaService';

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
        const { data: authData } = await supabase.auth.getUser();
        const activeUser = authData?.user;
        const userId = activeUser?.id;

        if (!userId) {
          throw new Error('You must be signed in to create a discussion topic.');
        }

        // Upload local images to Supabase Storage to get permanent public HTTPS URLs
        const uploadedImages = imageUrls && imageUrls.length > 0
          ? await uploadCommunityImages(imageUrls, userId)
          : undefined;

        const nowIso = new Date().toISOString();
        const newThread: ForumThread = {
          id: `custom_${Date.now()}`,
          userId,
          user_id: userId,
          title: title.trim(),
          category: category.trim(),
          author: author.trim() || 'Anonymous Reader',
          body: body.trim(),
          author_avatar_url: authorAvatarUrl || null,
          authorAvatarUrl: authorAvatarUrl || undefined,
          repliesCount: 0,
          created_at: nowIso,
          createdAt: nowIso,
          lastReplyAt: nowIso,
          image_urls: uploadedImages && uploadedImages.length > 0 ? uploadedImages : null,
          imageUrls: uploadedImages && uploadedImages.length > 0 ? uploadedImages : undefined,
        };

        // Sync to Supabase community_threads with verified session user_id
        await insertWithFallback(
          'community_threads',
          {
            id: newThread.id,
            user_id: userId,
            title: newThread.title,
            category: newThread.category,
            author: newThread.author,
            body: body.trim(),
            author_avatar_url: newThread.authorAvatarUrl ?? null,
            image_urls: newThread.imageUrls ?? null,
            created_at: nowIso,
          },
          {
            id: newThread.id,
            user_id: userId,
            title: newThread.title,
            category: newThread.category,
            author: newThread.author,
            body: body.trim(),
            created_at: nowIso,
          }
        );

        set((state) => ({
          userThreads: [newThread, ...state.userThreads],
          threadReplies: {
            ...state.threadReplies,
            [newThread.id]: [],
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
        const { data: authData } = await supabase.auth.getUser();
        const activeUser = authData?.user;
        const userId = activeUser?.id;

        if (!userId) {
          throw new Error('You must be signed in to post a reply.');
        }

        // Upload local images to Supabase Storage to get permanent public HTTPS URLs
        const uploadedImages = imageUrls && imageUrls.length > 0
          ? await uploadCommunityImages(imageUrls, userId)
          : undefined;

        const replyObj: ForumComment = {
          id: `reply_${Date.now()}`,
          userId,
          user_id: userId,
          username: author.trim() || 'Yomite Reader',
          avatarUrl: avatarUrl || undefined,
          postedAt: new Date().toISOString(),
          body: body.trim(),
          likes: 1,
          imageUrls: uploadedImages && uploadedImages.length > 0 ? [...uploadedImages] : undefined,
          replyTo: replyTo?.trim() ? replyTo.trim() : undefined,
        };

        // Sync to Supabase thread_replies with verified session user_id
        await insertWithFallback(
          'thread_replies',
          {
            thread_id: threadId,
            user_id: userId,
            username: replyObj.username,
            body: replyObj.body,
            avatar_url: replyObj.avatarUrl ?? null,
            image_urls: replyObj.imageUrls ?? null,
            reply_to: replyObj.replyTo ?? null,
          },
          {
            thread_id: threadId,
            user_id: userId,
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
