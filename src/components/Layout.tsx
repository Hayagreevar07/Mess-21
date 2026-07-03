import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
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
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: '0.9rem',
            marginRight: '6px',
            fontFamily: 'serif'
          }}>S</div>
          <span>Scheward</span>
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
