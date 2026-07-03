import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  HelpCircle,
  CheckSquare
} from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'

export default function BottomNav() {
  const { profile } = useAuth()

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Mess', roles: ['admin', 'representative', 'member'] },
    { to: '/expenses', icon: CreditCard, label: 'Expense', roles: ['admin', 'representative', 'member'] },
    { to: '/queries', icon: HelpCircle, label: 'Notes', roles: ['admin', 'representative', 'member'] },
    { to: '/tasks', icon: CheckSquare, label: 'Todo', roles: ['admin', 'representative', 'member'] },
  ]

  const filteredItems = navItems.filter(
    item => profile && item.roles.includes(profile.role)
  )

  return (
    <nav className="bottom-nav">
      {filteredItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
