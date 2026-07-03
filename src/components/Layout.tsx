import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, UtensilsCrossed } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button 
          className="btn-icon" 
          onClick={() => setSidebarOpen(true)}
          style={{ background: 'transparent', width: '34px' }}
        >
          <Menu size={24} color="var(--text-primary)" />
        </button>
        <div className="mobile-header-logo">
          <UtensilsCrossed size={20} />
          <span>MessManager</span>
        </div>
        <div style={{ width: '34px' }}></div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="main-content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
