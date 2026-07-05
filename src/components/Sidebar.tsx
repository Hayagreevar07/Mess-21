import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  Home, 
  Receipt, 
  WalletCards, 
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  MessageSquare,
  ListTodo,
  CalendarCheck,
  ArrowRightLeft
} from 'lucide-react'

const NAV_EMOJIS: Record<string, string> = {
  '/dashboard': '📊',
  '/menu': '📋',
  '/meals': '🍽️',
  '/expenses': '🧾',
  '/bills': '💳',
  '/budget': '💰',
  '/queries': '💬',
  '/members': '👥',
  '/transactions': '💸',
  '/tasks': '☑️',
  '/settings': '⚙️',
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  pendingTaskCount?: number
}

export default function Sidebar({ isOpen = false, onClose, pendingTaskCount = 0 }: SidebarProps) {
  const { profile, user, signOut } = useAuth()

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Mess', roles: ['admin', 'representative', 'member'] },
    { to: '/menu', icon: Home, label: 'Menu', roles: ['admin', 'representative', 'member'] },
    { to: '/meals', icon: CalendarCheck, label: 'Meals', roles: ['admin', 'representative', 'member'] },
    { to: '/expenses', icon: Receipt, label: 'Expense', roles: ['admin', 'representative', 'member'] },
    { to: '/bills', icon: WalletCards, label: 'Bills', roles: ['admin', 'representative', 'member'] },
    { to: '/budget', icon: WalletCards, label: 'Budget', roles: ['admin', 'representative', 'member'] },
    { to: '/transactions', icon: ArrowRightLeft, label: 'Transfers', roles: ['admin', 'representative', 'member'] },
    { to: '/tasks', icon: ListTodo, label: 'Todo', roles: ['admin', 'representative', 'member'] },
    { to: '/queries', icon: MessageSquare, label: 'Notes', roles: ['admin', 'representative', 'member'] },
    { to: '/members', icon: Users, label: 'Members', roles: ['admin', 'representative'] },
    { to: '/settings', icon: Settings, label: 'Settings', roles: ['admin', 'representative', 'member'] },
  ]

  const filteredItems = navItems.filter(
    item => profile && item.roles.includes(profile.role)
  )

  // Use Google profile photo if available
  const avatarUrl = user?.photoURL || profile?.avatar_url

  return (
    <>
      <div 
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`} 
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: '1.2rem',
            marginRight: '8px',
            fontFamily: 'serif'
          }}>S</div>
          <div>
            <span>Scheward</span>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '-4px', fontWeight: 600, letterSpacing: '1px' }}>SINCE 2026</div>
          </div>
        </div>
        </div>

      <nav className="sidebar-nav">
        {filteredItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <div style={{ position: 'relative' }}>
              <item.icon size={20} />
              {item.to === '/tasks' && pendingTaskCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 8,
                  height: 8,
                  backgroundColor: 'var(--danger)',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 2px var(--bg-card)'
                }} />
              )}
            </div>
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
    </>
  )
}
