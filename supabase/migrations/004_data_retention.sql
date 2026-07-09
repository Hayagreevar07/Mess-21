-- ============================================
-- Migration 004: Data Retention Policies
-- - Delete messages older than 6 months
-- - Delete paid bills older than 3 months
-- ============================================

-- Enable the pg_cron extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Schedule a daily job to clean up old messages
-- Runs at midnight every day
SELECT cron.schedule(
  'cleanup_old_messages',
  '0 0 * * *',
  $$
    DELETE FROM public.messages 
    WHERE created_at < NOW() - INTERVAL '6 months';
  $$
);

-- 2. Schedule a daily job to clean up old paid bills
-- Runs at midnight every day
SELECT cron.schedule(
  'cleanup_old_paid_bills',
  '0 0 * * *',
  $$
    DELETE FROM public.due_bills 
    WHERE is_paid = true 
      AND paid_at < NOW() - INTERVAL '3 months';
  $$
);
