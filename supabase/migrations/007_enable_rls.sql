-- ============================================
-- Migration 007: Enable Row Level Security
-- Locks down the database so only users with a 
-- valid Firebase JWT can access data.
-- ============================================

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mess_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_bills ENABLE ROW LEVEL SECURITY;

-- 2. Create basic policies requiring authentication
-- Since Firebase is handling auth and we are passing the custom JWT,
-- auth.jwt()->>'sub' will map to the Firebase user's UID (which is a string).
-- auth.uid() only works for proper UUIDs, so we must use auth.jwt()->>'sub' instead.

-- Profiles
CREATE POLICY "Authenticated users can read profiles" 
ON public.profiles FOR SELECT USING ((auth.jwt()->>'sub') IS NOT NULL);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK ((auth.jwt()->>'sub') = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING ((auth.jwt()->>'sub') = id);

-- Meal Logs
CREATE POLICY "Authenticated users can read meal logs" 
ON public.meal_logs FOR SELECT USING ((auth.jwt()->>'sub') IS NOT NULL);

CREATE POLICY "Authenticated users can insert meal logs" 
ON public.meal_logs FOR INSERT WITH CHECK ((auth.jwt()->>'sub') IS NOT NULL);

CREATE POLICY "Authenticated users can update meal logs" 
ON public.meal_logs FOR UPDATE USING ((auth.jwt()->>'sub') IS NOT NULL);

CREATE POLICY "Authenticated users can delete meal logs" 
ON public.meal_logs FOR DELETE USING ((auth.jwt()->>'sub') IS NOT NULL);

-- Other tables: General Authenticated Access
-- We rely on the app UI to restrict admin actions (as per previous design), 
-- but we completely block anonymous API abuse.

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename NOT IN ('profiles', 'meal_logs')
  LOOP
    EXECUTE format('CREATE POLICY "Authenticated users can read %I" ON public.%I FOR SELECT USING ((auth.jwt()->>''sub'') IS NOT NULL)', table_name, table_name);
    EXECUTE format('CREATE POLICY "Authenticated users can insert %I" ON public.%I FOR INSERT WITH CHECK ((auth.jwt()->>''sub'') IS NOT NULL)', table_name, table_name);
    EXECUTE format('CREATE POLICY "Authenticated users can update %I" ON public.%I FOR UPDATE USING ((auth.jwt()->>''sub'') IS NOT NULL)', table_name, table_name);
    EXECUTE format('CREATE POLICY "Authenticated users can delete %I" ON public.%I FOR DELETE USING ((auth.jwt()->>''sub'') IS NOT NULL)', table_name, table_name);
  END LOOP;
END;
$$;
