-- ============================================
-- Migration 006: Monthly Bills Snapshot & Cleanup
-- - Create monthly_bills table
-- - Procedure to snapshot bills and clear meal_logs
-- - Cron job to snapshot at the end of the month
-- - Cron job to clean monthly_bills after 3 months
-- ============================================

CREATE TABLE IF NOT EXISTS public.monthly_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
  total_meal_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  expense_share NUMERIC(10, 2) NOT NULL DEFAULT 0,
  meal_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries on month and member
CREATE INDEX IF NOT EXISTS idx_monthly_bills_month ON public.monthly_bills(month);
CREATE INDEX IF NOT EXISTS idx_monthly_bills_member_month ON public.monthly_bills(member_id, month);

-- Procedure to snapshot the previous month's bills and delete old meal_logs
CREATE OR REPLACE FUNCTION public.snapshot_and_clear_month(target_month TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  member_record RECORD;
  meal_rec RECORD;
  expense_total NUMERIC := 0;
  active_members_count INT := 0;
  share NUMERIC := 0;
  meal_json JSONB;
  meal_total NUMERIC := 0;
BEGIN
  -- 1. Determine date range
  start_date := (target_month || '-01')::DATE;
  end_date := start_date + INTERVAL '1 month' - INTERVAL '1 day';

  -- 2. Calculate global expense share for the month
  SELECT COALESCE(SUM(amount), 0) INTO expense_total
  FROM public.expenses
  WHERE date >= start_date AND date <= end_date AND split_type != 'personal';

  SELECT COUNT(*) INTO active_members_count
  FROM public.profiles;

  IF active_members_count > 0 THEN
    share := expense_total / active_members_count;
  END IF;

  -- 3. Loop through each member to aggregate their meals
  FOR member_record IN SELECT id FROM public.profiles LOOP
    
    -- Aggregate meals into JSON and calculate total
    WITH member_meals AS (
      SELECT 
        m.name AS item_name,
        SUM(ml.quantity) AS qty,
        SUM(ml.quantity * m.price) AS total_cost
      FROM public.meal_logs ml
      JOIN public.menu_items m ON ml.menu_item_id = m.id
      WHERE ml.member_id = member_record.id
        AND ml.date >= start_date 
        AND ml.date <= end_date
      GROUP BY m.name
    )
    SELECT 
      COALESCE(jsonb_object_agg(item_name, json_build_object('qty', qty, 'total', total_cost)) FILTER (WHERE item_name IS NOT NULL), '{}'::jsonb),
      COALESCE(SUM(total_cost), 0)
    INTO meal_json, meal_total
    FROM member_meals;

    -- Only insert if there was any activity (meals or expenses)
    IF meal_total > 0 OR share > 0 THEN
      INSERT INTO public.monthly_bills (member_id, month, total_meal_amount, expense_share, meal_details)
      VALUES (member_record.id, target_month, meal_total, share, COALESCE(meal_json, '{}'::jsonb));
    END IF;

  END LOOP;

  -- 4. Delete the meal_logs for that month to save space
  DELETE FROM public.meal_logs
  WHERE date >= start_date AND date <= end_date;

END;
$$;

-- Schedule jobs (Enable pg_cron if not already)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job 1: Run snapshot at 1 AM on the 1st of every month
-- It will snapshot the *previous* month
SELECT cron.schedule(
  'snapshot_previous_month',
  '0 1 1 * *',
  $$
    SELECT public.snapshot_and_clear_month(to_char(NOW() - INTERVAL '1 month', 'YYYY-MM'));
  $$
);

-- Job 2: Delete monthly_bills older than 3 months
SELECT cron.schedule(
  'cleanup_monthly_bills',
  '0 2 * * *',
  $$
    DELETE FROM public.monthly_bills 
    WHERE created_at < NOW() - INTERVAL '3 months';
  $$
);
