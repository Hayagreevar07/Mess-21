-- ============================================
-- Migration 005: Push Notifications
-- - Add fcm_token to profiles for real-time background notifications
-- ============================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;
