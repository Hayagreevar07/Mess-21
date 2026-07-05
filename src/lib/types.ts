export type Role = 'admin' | 'representative' | 'member'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type MenuCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  rep_id?: string
  avatar_url?: string
  fcm_token?: string
  created_at: string
}

export interface MenuItem {
  id: string
  name: string
  price: number
  category: MenuCategory
  is_available: boolean
  created_at: string
}

export interface MealLog {
  id: string
  member_id: string
  menu_item_id: string
  meal_type: MealType
  date: string
  quantity: number
  logged_by: string
  created_at: string
  menu_item?: MenuItem
  member?: Profile
}

export interface Expense {
  id: string
  title: string
  amount: number
  category: string
  date: string
  added_by: string
  created_at: string
  added_by_profile?: Profile
}

export interface DueBill {
  id: string
  member_id: string
  amount: number
  month: string
  due_date: string
  is_paid: boolean
  paid_at?: string
  created_at: string
  member?: Profile
}

export interface MessSettings {
  id: string
  mess_name: string
  monthly_start_day: number
  created_at: string
}

export interface SupportQuery {
  id: string
  member_id: string
  subject: string
  description: string
  status: 'open' | 'resolved'
  resolved_by?: string
  created_at: string
  resolved_at?: string
  member?: Profile
  resolver?: Profile
}

export interface Invitation {
  id: string
  email: string
  pin_code: string
  role: Role
  status: 'pending' | 'accepted'
  created_by: string
  created_at: string
  creator?: Profile
}

export interface Transaction {
  id: string
  from_id: string | null
  to_id: string | null
  amount: number
  type: 'lend' | 'repay' | 'mess_bill'
  status: 'pending' | 'completed' | 'rejected'
  description?: string
  created_at: string
  from_profile?: Profile
  to_profile?: Profile
}

export interface Task {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  due_date?: string
  assigned_to?: string
  created_at: string
  assignee?: Profile
}
