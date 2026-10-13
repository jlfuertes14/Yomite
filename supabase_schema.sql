-- ─────────────────────────────────────────────────────────────
-- YOMITE SUPABASE DATABASE & STORAGE SCHEMA
-- Run this complete SQL script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ─────────────────────────────────────────────────────────────

-- 1. READING HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.user_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    manga_id TEXT NOT NULL,
    manga_title TEXT NOT NULL,
    cover_url TEXT,
    chapter_id TEXT NOT NULL,
    chapter_title TEXT,
    page_index INT DEFAULT 0,
    total_pages INT DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_history_user_manga_unique UNIQUE (user_id, manga_id)
);

-- 2. LIBRARY BOOKMARKS TABLE
CREATE TABLE IF NOT EXISTS public.user_library (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    manga_id TEXT NOT NULL,
    title TEXT NOT NULL,
    cover_url TEXT,
    category TEXT DEFAULT 'Reading',
    total_chapters INT DEFAULT 0,
    unread_count INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_library_user_manga_unique UNIQUE (user_id, manga_id)
);

-- 3. COMMUNITY FORUM THREADS (Optional)
CREATE TABLE IF NOT EXISTS public.community_threads (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    author_avatar_url TEXT,
    image_urls TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.thread_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    username TEXT NOT NULL,
    body TEXT NOT NULL,
    avatar_url TEXT,
    image_urls TEXT[],
    reply_to TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.user_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_replies ENABLE ROW LEVEL SECURITY;

-- 4b. GRANT TABLE ACCESS TO PostgREST ROLES
-- Without these, PostgREST returns 400 Bad Request for authenticated users.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_library TO authenticated;
GRANT SELECT ON public.community_threads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_threads TO authenticated;
GRANT SELECT ON public.thread_replies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_replies TO authenticated;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- 5. RLS POLICIES FOR USER HISTORY
DROP POLICY IF EXISTS "Users can manage their own history" ON public.user_history;
CREATE POLICY "Users can manage their own history" ON public.user_history
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. RLS POLICIES FOR USER LIBRARY
DROP POLICY IF EXISTS "Users can manage their own library" ON public.user_library;
CREATE POLICY "Users can manage their own library" ON public.user_library
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 7. RLS POLICIES FOR COMMUNITY (Read all, authenticated write bound to user_id)
DROP POLICY IF EXISTS "Anyone can read community threads" ON public.community_threads;
CREATE POLICY "Anyone can read community threads" ON public.community_threads
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert community threads" ON public.community_threads;
DROP POLICY IF EXISTS "Authenticated users can create threads" ON public.community_threads;
CREATE POLICY "Authenticated users can create threads" ON public.community_threads
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can update their own threads" ON public.community_threads;
CREATE POLICY "Authors can update their own threads" ON public.community_threads
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can delete their own threads" ON public.community_threads;
CREATE POLICY "Authors can delete their own threads" ON public.community_threads
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can read thread replies" ON public.thread_replies;
CREATE POLICY "Anyone can read thread replies" ON public.thread_replies
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert thread replies" ON public.thread_replies;
DROP POLICY IF EXISTS "Authenticated users can post replies" ON public.thread_replies;
CREATE POLICY "Authenticated users can post replies" ON public.thread_replies
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own replies" ON public.thread_replies;
CREATE POLICY "Users can delete their own replies" ON public.thread_replies
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- 9. COMMUNITY MIGRATIONS (Safe to re-run in Supabase SQL editor)
ALTER TABLE public.community_threads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.community_threads ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;
ALTER TABLE public.community_threads ADD COLUMN IF NOT EXISTS image_urls TEXT[];
ALTER TABLE public.thread_replies ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.thread_replies ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.thread_replies ADD COLUMN IF NOT EXISTS image_urls TEXT[];
ALTER TABLE public.thread_replies ADD COLUMN IF NOT EXISTS reply_to TEXT;

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- 8. STORAGE BUCKET FOR AVATARS (Scoped to user_id folder prefix)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for avatars
DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
CREATE POLICY "Public Avatar Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated User Avatar Upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Authenticated User Avatar Update" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- 10. HIGH-PERFORMANCE QUERY INDEXES
-- Core user history and library indexes
CREATE INDEX IF NOT EXISTS idx_user_history_user_updated ON public.user_history (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_library_user_cat ON public.user_library (user_id, category);

-- Community indexes for fast thread and reply lookups
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'community_threads') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_community_threads_user_id ON public.community_threads (user_id)';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'thread_replies') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_thread_replies_thread_id ON public.thread_replies (thread_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_thread_replies_user_id ON public.thread_replies (user_id)';
  END IF;
END $$;

