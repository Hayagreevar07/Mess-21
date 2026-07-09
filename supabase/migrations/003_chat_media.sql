-- ============================================
-- Migration 003: Chat Media & Voice
-- - Add media_url and media_type to messages
-- - Setup chat_media storage bucket
-- ============================================

-- 1. Add columns to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'audio'));

-- 2. Create the chat_media bucket in Supabase Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_media', 'chat_media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Policies for chat_media
-- Since Firebase handles auth, we use RLS bypass or anon/authenticated policies.
-- In this schema, we typically allow all operations since app-level handles auth, 
-- but for storage, we can grant anon and authenticated access.
CREATE POLICY "Allow public read access for chat_media" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'chat_media');

CREATE POLICY "Allow authenticated uploads to chat_media" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'chat_media');

CREATE POLICY "Allow authenticated updates to chat_media" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'chat_media');

CREATE POLICY "Allow authenticated deletes from chat_media" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'chat_media');
