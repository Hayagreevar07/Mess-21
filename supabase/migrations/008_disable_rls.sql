-- ============================================
-- Migration 008: Disable RLS for compatibility with Firebase Auth
-- ============================================

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.due_bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mess_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_bills DISABLE ROW LEVEL SECURITY;
