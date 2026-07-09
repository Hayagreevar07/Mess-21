import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, AlertTriangle, DollarSign, MessageCircle } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import UpdateBanner from './UpdateBanner'
import PageTransition from './PageTransition'
import { useAuth } from '../contexts/AuthContext'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../lib/dateUtils'
import GlobalChatListener from './chat/GlobalChatListener'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile, user } = useAuth()
  const avatarUrl = user?.photoURL || profile?.avatar_url
  const location = useLocation()
  const navigate = useNavigate()
  const [pendingTaskCount, setPendingTaskCount] = useState(0)
  const [mealLoggedToday, setMealLoggedToday] = useState(true)
  const [hasUnpaidDues, setHasUnpaidDues] = useState(false)

  useEffect(() => {
    if (!profile) return
    const fetchTasksAndMeals = async () => {
      const [{ count }, { data: mealData }, { data: duesData }] = await Promise.all([
        supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', profile.id)
          .neq('status', 'done'),
        supabase
          .from('meal_logs')
          .select('id')
          .eq('member_id', profile.id)
          .eq('date', getLocalDateString())
          .limit(1),
        supabase
          .from('due_bills')
          .select('id')
          .eq('member_id', profile.id)
          .eq('is_paid', false)
          .limit(1)
      ])
      setPendingTaskCount(count || 0)
      setMealLoggedToday((mealData && mealData.length > 0) || false)
      setHasUnpaidDues((duesData && duesData.length > 0) || false)

      // Auto-cleanup for admin
      if (profile.role === 'admin') {
        const elevenMonthsAgo = new Date()
        elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11)
        const cutoffDate = elevenMonthsAgo.toISOString()
        const cutoffDateOnly = getLocalDateString(elevenMonthsAgo)
        
        // Fire and forget cleanups
        supabase.from('due_bills').delete().eq('is_paid', true).lt('created_at', cutoffDate).then()
        supabase.from('transactions').delete().eq('status', 'completed').lt('created_at', cutoffDate).then()
        supabase.from('meal_logs').delete().lt('date', cutoffDateOnly).then()
        supabase.from('expenses').delete().lt('date', cutoffDateOnly).then()
      }
    }
    fetchTasksAndMeals()
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
        <div 
          onClick={() => navigate('/settings')}
          style={{ 
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
          overflow: 'hidden',
          cursor: 'pointer'
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
        {!mealLoggedToday && location.pathname !== '/meals' && (
          <div style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger-light)' }}>
              <AlertTriangle size={20} className="pulse-icon" />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>You haven't logged your meals for today!</span>
            </div>
            <button className="btn btn-sm btn-danger-fill" onClick={() => navigate('/meals')}>
              Log Now
            </button>
          </div>
        )}
        {hasUnpaidDues && location.pathname !== '/bills' && (
          <div style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 0 15px rgba(245, 158, 11, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
              <DollarSign size={20} className="pulse-icon" />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>You have pending dues!</span>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/bills')} style={{ background: 'var(--warning)', color: '#000' }}>
              View Bills
            </button>
          </div>
        )}
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
      
      <GlobalChatListener />

      {/* Floating Chat Button */}
      {location.pathname !== '/messages' && (
        <button
          onClick={() => navigate('/messages')}
          style={{
            position: 'fixed',
            bottom: '80px', // Above bottom nav
            right: '20px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--primary)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: 'none',
            cursor: 'pointer',
            zIndex: 99,
          }}
        >
          <MessageCircle size={24} />
        </button>
      )}

      <BottomNav />
      <UpdateBanner />
    </div>
  )
}
