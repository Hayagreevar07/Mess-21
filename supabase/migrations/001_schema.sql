-- ============================================
-- MessManager Database Schema (Supabase)
-- Firebase handles authentication.
-- Supabase handles data storage.
-- Run this in Supabase SQL Editor.
-- ============================================

-- Profiles: stores user info keyed by Firebase UID
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'representative', 'member')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- ============================================
-- NOTE: RLS is NOT enabled because Firebase
-- handles authentication, not Supabase Auth.
-- Authorization is enforced at the app level.
-- ============================================

-- ============================================
-- Default Menu Items (South Indian Mess)
-- ============================================
INSERT INTO menu_items (name, price, category) VALUES
  ('Idli (2 pcs)', 20, 'breakfast'),
  ('Masala Dosa', 35, 'breakfast'),
  ('Plain Dosa', 30, 'breakfast'),
  ('Vada (2 pcs)', 15, 'breakfast'),
  ('Poori (3 pcs)', 25, 'breakfast'),
  ('Upma', 20, 'breakfast'),
  ('Pongal', 25, 'breakfast'),
  ('Rava Dosa', 35, 'breakfast'),
  ('Uttapam', 30, 'breakfast'),
  ('Chapati (3 pcs)', 30, 'lunch'),
  ('Rice Plate (Meals)', 50, 'lunch'),
  ('Sambar Rice', 40, 'lunch'),
  ('Curd Rice', 35, 'lunch'),
  ('Lemon Rice', 35, 'lunch'),
  ('Tomato Rice', 35, 'lunch'),
  ('Veg Biryani', 60, 'lunch'),
  ('Chicken Biryani', 80, 'lunch'),
  ('Egg Biryani', 70, 'lunch'),
  ('Chapati (3 pcs)', 30, 'dinner'),
  ('Parotta (2 pcs)', 30, 'dinner'),
  ('Fried Rice', 45, 'dinner'),
  ('Noodles', 40, 'dinner'),
  ('Egg Rice', 50, 'dinner'),
  ('Roti with Curry', 35, 'dinner'),
  ('Dosa', 30, 'dinner'),
  ('Tea', 10, 'snack'),
  ('Coffee', 15, 'snack'),
  ('Biscuit Pack', 10, 'snack'),
  ('Juice', 20, 'snack'),
  ('Banana', 5, 'snack'),
  ('Samosa (2 pcs)', 15, 'snack'),
  ('Bajji (4 pcs)', 20, 'snack'),
  ('Bonda (3 pcs)', 15, 'snack');

-- Default mess settings
INSERT INTO mess_settings (mess_name, monthly_start_day) VALUES ('My Mess', 1);
