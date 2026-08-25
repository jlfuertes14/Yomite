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
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.thread_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id TEXT NOT NULL,
    username TEXT NOT NULL,
    body TEXT NOT NULL,
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
GRANT SELECT, INSERT ON public.community_threads TO anon, authenticated;
GRANT SELECT, INSERT ON public.thread_replies TO anon, authenticated;

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

-- 7. RLS POLICIES FOR COMMUNITY (Read all, authenticated write)
DROP POLICY IF EXISTS "Anyone can read community threads" ON public.community_threads;
CREATE POLICY "Anyone can read community threads" ON public.community_threads
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert community threads" ON public.community_threads;
CREATE POLICY "Anyone can insert community threads" ON public.community_threads
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read thread replies" ON public.thread_replies;
CREATE POLICY "Anyone can read thread replies" ON public.thread_replies
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert thread replies" ON public.thread_replies;
CREATE POLICY "Anyone can insert thread replies" ON public.thread_replies
    FOR INSERT WITH CHECK (true);

-- 8. STORAGE BUCKET FOR AVATARS (Run to create public avatars bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for avatars
DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
CREATE POLICY "Public Avatar Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated User Avatar Upload" ON storage.objects;
CREATE POLICY "Authenticated User Avatar Upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated User Avatar Update" ON storage.objects;
CREATE POLICY "Authenticated User Avatar Update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'avatars');
