import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  UtensilsCrossed,
  CalendarCheck,
  CreditCard,
  PiggyBank
} from 'lucide-react'

export default function BottomNav() {
  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/menu', icon: UtensilsCrossed, label: 'Menu' },
    { to: '/meals', icon: CalendarCheck, label: 'Meals' },
    { to: '/bills', icon: CreditCard, label: 'Bills' },
    { to: '/budget', icon: PiggyBank, label: 'Budget' },
  ]

  return (
    <nav className="bottom-nav">
      {navItems.map(item => (
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
