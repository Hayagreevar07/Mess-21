import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button 
          onClick={() => setSidebarOpen(true)}
          style={{ 
            width: '34px', 
            height: '34px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0
          }}
        >
          <Menu size={24} />
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
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: '50%', 
          background: 'var(--bg-glass-strong)', 
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-secondary)'
        }}>
          ?
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="main-content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
