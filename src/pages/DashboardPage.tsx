import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import StatCard from '../components/StatCard'
import {
  IndianRupee,
  UtensilsCrossed,
  Receipt,
  CreditCard,
  TrendingUp,
  Users,
  CalendarCheck,
  PiggyBank,
  Settings,
  Plus,
} from 'lucide-react'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return { text: 'Good Morning', emoji: '🌅', period: 'morning' }
  if (hour < 17) return { text: 'Good Afternoon', emoji: '☀️', period: 'afternoon' }
  if (hour < 21) return { text: 'Good Evening', emoji: '🌆', period: 'evening' }
  return { text: 'Good Night', emoji: '🌙', period: 'night' }
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function DashboardPage() {
  const { profile, role } = useAuth()
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalMenuItems: 0,
    monthlyExpenses: 0,
    pendingBills: 0,
    totalMealsToday: 0,
    myMonthlySpend: 0,
  })
  const [recentMeals, setRecentMeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fabOpen, setFabOpen] = useState(false)

  const greeting = getGreeting()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      ).toISOString().split('T')[0]

      const { count: memberCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      const { count: menuCount } = await supabase
        .from('menu_items')
        .select('*', { count: 'exact', head: true })

      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', monthStart)
      const totalExpenses = expenses?.reduce(
        (sum, e) => sum + Number(e.amount), 0
      ) || 0

      const { count: pendingCount } = await supabase
        .from('due_bills')
        .select('*', { count: 'exact', head: true })
        .eq('is_paid', false)

      const { count: todayMeals } = await supabase
        .from('meal_logs')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)

      let mySpend = 0
      if (profile) {
        const { data: myMeals } = await supabase
          .from('meal_logs')
          .select('quantity, menu_item:menu_items(price)')
          .eq('member_id', profile.id)
          .gte('date', monthStart)
        mySpend = myMeals?.reduce((sum, m) => {
          const price = Number((m.menu_item as any)?.price) || 0
          return sum + price * m.quantity
        }, 0) || 0
      }

      const { data: recent } = await supabase
        .from('meal_logs')
        .select('*, menu_item:menu_items(name, price), member:profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({
        totalMembers: memberCount || 0,
        totalMenuItems: menuCount || 0,
        monthlyExpenses: totalExpenses,
        pendingBills: pendingCount || 0,
        totalMealsToday: todayMeals || 0,
        myMonthlySpend: mySpend,
      })
      setRecentMeals(recent || [])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Quick actions based on role
  const quickActions = [
    { to: '/meals', icon: '🍽️', lucide: CalendarCheck, label: 'Log Meals', roles: ['admin', 'representative'] },
    { to: '/menu', icon: '📋', lucide: UtensilsCrossed, label: 'View Menu', roles: ['admin', 'representative', 'member'] },
    { to: '/bills', icon: '💳', lucide: CreditCard, label: 'View Bills', roles: ['admin', 'representative', 'member'] },
    { to: '/budget', icon: '📊', lucide: PiggyBank, label: 'My Budget', roles: ['admin', 'representative', 'member'] },
    { to: '/expenses', icon: '🧾', lucide: Receipt, label: 'Expenses', roles: ['admin', 'representative'] },
    { to: '/settings', icon: '⚙️', lucide: Settings, label: 'Settings', roles: ['admin'] },
  ].filter(a => role && a.roles.includes(role))

  // FAB actions
  const fabActions = [
    { to: '/meals', icon: CalendarCheck, label: 'Log Meal' },
    { to: '/expenses', icon: Receipt, label: 'Add Expense' },
    { to: '/bills', icon: CreditCard, label: 'Add Bill' },
  ]

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div className="greeting-section">
          <div className="skeleton" style={{ width: '260px', height: '36px', marginBottom: '8px' }}></div>
          <div className="skeleton" style={{ width: '200px', height: '20px' }}></div>
        </div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton skeleton-stat"></div>
          ))}
        </div>
        <div className="skeleton" style={{ width: '150px', height: '24px', marginBottom: '16px' }}></div>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton skeleton-card"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="page dashboard-page">
      {/* Greeting Section */}
      <div className="greeting-section">
        <div className="greeting-row">
          <div>
            <h1 className="greeting-text">
              {greeting.text}, {profile?.full_name?.split(' ')[0]} <span className="greeting-emoji">{greeting.emoji}</span>
            </h1>
            <p className="greeting-subtitle">
              Here's your mess overview for today
            </p>
          </div>
          <span className="greeting-date">{getFormattedDate()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <span className={`role-badge role-${role}`}>{role}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        {quickActions.map(action => (
          <Link key={action.to} to={action.to} className="quick-action-btn">
            <div className="quick-action-icon">
              <span>{action.icon}</span>
            </div>
            <span className="quick-action-label">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Animated Gradient Divider */}
      <div className="gradient-divider"></div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {(role === 'admin' || role === 'representative') && (
          <>
            <StatCard
              title="Members"
              value={stats.totalMembers}
              icon={Users}
              color="#8b5cf6"
            />
            <StatCard
              title="Menu Items"
              value={stats.totalMenuItems}
              icon={UtensilsCrossed}
              color="#06b6d4"
            />
            <StatCard
              title="Monthly Expenses"
              value={`₹${stats.monthlyExpenses.toLocaleString()}`}
              icon={Receipt}
              color="#f59e0b"
            />
            <StatCard
              title="Pending Bills"
              value={stats.pendingBills}
              icon={CreditCard}
              color="#ef4444"
              subtitle={stats.pendingBills > 0 ? '⚠️ Action needed' : '✅ All clear'}
            />
            <StatCard
              title="Meals Today"
              value={stats.totalMealsToday}
              icon={TrendingUp}
              color="#10b981"
            />
          </>
        )}
        <StatCard
          title="My Spending"
          value={`₹${stats.myMonthlySpend.toLocaleString()}`}
          icon={IndianRupee}
          color="#a855f7"
          subtitle="This month"
        />
      </div>

      {/* Recent Activity */}
      <div className="dashboard-section">
        <h2>Recent Activity</h2>
        <div className="activity-list">
          {recentMeals.length === 0 ? (
            <div className="empty-state">
              <UtensilsCrossed size={48} />
              <p>No meals logged yet</p>
              <Link to="/meals" className="btn btn-primary" style={{ marginTop: '12px' }}>
                <CalendarCheck size={16} /> Log First Meal
              </Link>
            </div>
          ) : (
            recentMeals.map((meal) => (
              <div key={meal.id} className="activity-item">
                <div className="activity-icon">
                  <UtensilsCrossed size={16} />
                </div>
                <div className="activity-info">
                  <span className="activity-name">
                    {meal.member?.full_name}
                  </span>
                  <span className="activity-detail">
                    {meal.menu_item?.name} × {meal.quantity}
                  </span>
                </div>
                <span className="activity-amount">
                  ₹{Number(meal.menu_item?.price || 0) * meal.quantity}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      {(role === 'admin' || role === 'representative') && (
        <div className="fab-container">
          <button
            className={`fab-main ${fabOpen ? 'open' : ''}`}
            onClick={() => setFabOpen(prev => !prev)}
            aria-label="Quick actions"
          >
            <Plus size={24} />
          </button>
          <div className={`fab-actions ${fabOpen ? 'visible' : ''}`}>
            {fabActions.map(action => (
              <Link
                key={action.to}
                to={action.to}
                className="fab-action"
                onClick={() => setFabOpen(false)}
              >
                <span className="fab-action-label">{action.label}</span>
                <div className="fab-action-btn">
                  <action.icon size={18} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
