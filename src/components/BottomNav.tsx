import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarCheck,
  CreditCard,
  ArrowRightLeft,
  Settings
} from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'

interface BottomNavProps {
  pendingTaskCount?: number
}

export default function BottomNav({ pendingTaskCount = 0 }: BottomNavProps) {
  const { profile } = useAuth()

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Mess', roles: ['admin', 'representative', 'member'] },
    { to: '/meals', icon: CalendarCheck, label: 'Meals', roles: ['admin', 'representative', 'member'] },
    { to: '/bills', icon: CreditCard, label: 'Bills', roles: ['admin', 'representative', 'member'] },
    { to: '/transactions', icon: ArrowRightLeft, label: 'Transfers', roles: ['admin', 'representative', 'member'] },
    { to: '/settings', icon: Settings, label: 'More', roles: ['admin', 'representative', 'member'] },
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
