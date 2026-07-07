-- ============================================
-- MessManager Database Schema (Supabase)
-- Firebase handles authentication.
-- Supabase handles data storage.
-- Run this in Supabase SQL Editor.
-- ============================================

-- Fix for "schema public does not exist" error
CREATE SCHEMA IF NOT EXISTS public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
SET search_path TO public;

-- Profiles: stores user info keyed by Firebase UID
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'representative', 'member')),
  rep_id TEXT REFERENCES profiles(id),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add rep_id if it doesn't exist (in case of re-running script)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rep_id TEXT REFERENCES profiles(id);

-- Menu items catalog
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('breakfast', 'lunch', 'dinner', 'snack')),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily meal logs per member
CREATE TABLE IF NOT EXISTS meal_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity INTEGER NOT NULL DEFAULT 1,
  logged_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Miscellaneous expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  added_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Due bills / payment tracking
CREATE TABLE IF NOT EXISTS due_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  month TEXT NOT NULL,
  due_date DATE NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global mess settings
CREATE TABLE IF NOT EXISTS mess_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mess_name TEXT NOT NULL DEFAULT 'My Mess',
  monthly_start_day INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Queries (Member to Admin/Rep)
CREATE TABLE IF NOT EXISTS queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id TEXT REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Secure Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  pin_code TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_by TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advanced Transactions (Money Lending & Mess Dues)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_id TEXT REFERENCES profiles(id), -- NULL if money comes from Mess Fund
  to_id TEXT REFERENCES profiles(id),   -- NULL if money goes to Mess Fund
  amount NUMERIC(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('lend', 'repay', 'mess_bill')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- To-Do Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date DATE,
  assigned_to TEXT REFERENCES profiles(id),
  type TEXT DEFAULT 'group' CHECK (type IN ('personal', 'group')),
  has_alarm BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations for existing tables
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'group' CHECK (type IN ('personal', 'group'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS has_alarm BOOLEAN DEFAULT false;

-- ============================================
-- NOTE: RLS is NOT enabled because Firebase
-- handles authentication, not Supabase Auth.
-- Authorization is enforced at the app level.
-- ============================================

-- ============================================
-- Default Menu Items (South Indian Mess)
-- ============================================
INSERT INTO menu_items (name, price, category) VALUES
  ('Idli (2 pcs)', 25, 'breakfast'),
  ('Dosa', 20, 'breakfast'),
  ('other Dosa', 30, 'breakfast'),
  ('kitchedi', 60, 'breakfast'),
  ('Pongal', 50, 'breakfast'),
  ('Rice Plate (Meals)', 60, 'lunch'),
  ('Briyani', 130, 'lunch'),
  ('Rice and chicken gravy', 120, 'lunch'),
  ('Chapati', 25, 'dinner'),
  ('Egg Dosa', 40, 'dinner'),
  ('Egg chappathi', 40, 'dinner'),
  ('Idli (2 pcs)', 25, 'dinner'),
  ('Dosa', 20, 'dinner'),
  ('other Dosa', 30, 'dinner');

-- Default mess settings
INSERT INTO mess_settings (mess_name, monthly_start_day) VALUES ('My Mess', 1);