import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import UpdateBanner from './UpdateBanner'
import PageTransition from './PageTransition'
import { useAuth } from '../contexts/AuthContext'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile, user } = useAuth()
  const avatarUrl = user?.photoURL || profile?.avatar_url
  const location = useLocation()
  const [pendingTaskCount, setPendingTaskCount] = useState(0)

  useEffect(() => {
    if (!profile) return
    const fetchTasks = async () => {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .neq('status', 'done')
      setPendingTaskCount(count || 0)
    }
    fetchTasks()
  }, [profile, location.pathname])

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
            padding: 0,
            position: 'relative'
          }}
        >
          <Menu size={24} />
          {pendingTaskCount > 0 && (
            <span style={{
              position: 'absolute',
              top: 4,
              right: 2,
              width: 8,
              height: 8,
              backgroundColor: 'var(--danger)',
              borderRadius: '50%',
              boxShadow: '0 0 0 2px var(--bg-card)'
            }} />
          )}
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
          background: avatarUrl ? 'transparent' : 'var(--bg-glass-strong)', 
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          overflow: 'hidden'
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
          ) : (
            profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'
          )}
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} pendingTaskCount={pendingTaskCount} />
      
      <main className="main-content">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
      <BottomNav />
      <UpdateBanner />
    </div>
  )
}
