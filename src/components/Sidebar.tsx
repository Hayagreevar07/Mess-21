import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  UtensilsCrossed,
  CalendarCheck,
  Receipt,
  CreditCard,
  PiggyBank,
  Settings,
  LogOut,
  HelpCircle
} from 'lucide-react'

const NAV_EMOJIS: Record<string, string> = {
  '/dashboard': '📊',
  '/menu': '📋',
  '/meals': '🍽️',
  '/expenses': '🧾',
  '/bills': '💳',
  '/budget': '💰',
  '/queries': '💬',
  '/settings': '⚙️',
}

export default function Sidebar() {
  const { profile, user, signOut } = useAuth()

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'representative', 'member'] },
    { to: '/menu', icon: UtensilsCrossed, label: 'Menu', roles: ['admin', 'representative', 'member'] },
    { to: '/meals', icon: CalendarCheck, label: 'Meals', roles: ['admin', 'representative', 'member'] },
    { to: '/expenses', icon: Receipt, label: 'Expenses', roles: ['admin', 'representative'] },
    { to: '/bills', icon: CreditCard, label: 'Bills', roles: ['admin', 'representative', 'member'] },
    { to: '/budget', icon: PiggyBank, label: 'Budget', roles: ['admin', 'representative', 'member'] },
    { to: '/queries', icon: HelpCircle, label: 'Queries', roles: ['admin', 'representative', 'member'] },
    { to: '/settings', icon: Settings, label: 'Settings', roles: ['admin'] },
  ]

  const filteredItems = navItems.filter(
    item => profile && item.roles.includes(profile.role)
  )

  // Use Google profile photo if available
  const avatarUrl = user?.photoURL || profile?.avatar_url

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <UtensilsCrossed size={28} />
          <span>MessManager</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.9rem', opacity: 0.6 }}>
              {NAV_EMOJIS[item.to]}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={profile?.full_name || 'Avatar'}
              className="sidebar-avatar"
              referrerPolicy="no-referrer"
              style={{
                objectFit: 'cover',
                borderRadius: '50%',
              }}
            />
          ) : (
            <div className="sidebar-avatar">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="sidebar-user-info">
            <span className="sidebar-username">{profile?.full_name}</span>
            <span className="sidebar-role">{profile?.role}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={signOut} title="Sign Out">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  )
}
