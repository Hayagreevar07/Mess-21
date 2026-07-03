import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../lib/types'
import { supabase } from '../lib/supabase'
import { UtensilsCrossed, Shield, Users, UserCheck, Rocket } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SetupPage() {
  const { user, profile, loading, needsProfile, createProfile } = useAuth()
  const [fullName, setFullName] = useState(user?.displayName || '')
  const [role, setRole] = useState<Role>('member')
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdminAllowed = user?.email === adminEmail

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (profile && !needsProfile) return <Navigate to="/dashboard" replace />

  const handleSubmit = async () => {
    if (!fullName.trim()) return toast.error('Enter your name')
    
    setSubmitting(true)
    try {
      if (!isAdminAllowed && role === 'member') {
        if (!pin.trim()) {
          setSubmitting(false)
          return toast.error('Invite PIN is required')
        }
        
        // Verify PIN and email against invitations table
        const { data: inviteData, error: inviteError } = await supabase
          .from('invitations')
          .select('*')
          .eq('email', user.email?.toLowerCase())
          .eq('pin_code', pin.trim())
          .eq('status', 'pending')
          .single()

        if (inviteError || !inviteData) {
          setSubmitting(false)
          return toast.error('Invalid PIN or email not invited')
        }

        // Enforce the role assigned in the invitation
        if (inviteData.role !== role) {
          setSubmitting(false)
          return toast.error(`You were invited as a ${inviteData.role}, please select that role.`)
        }

        // Mark as accepted
        await supabase.from('invitations').update({ status: 'accepted' }).eq('id', inviteData.id)
        
        await createProfile(fullName.trim(), role, inviteData.created_by)
      } else {
        await createProfile(fullName.trim(), role)
      }

      toast.success('Welcome to MessManager! 🎉')
    } catch (err: any) {
      toast.error(err.message || 'Setup failed')
    } finally {
      setSubmitting(false)
    }
  }

  const roles: {
    value: Role
    label: string
    icon: typeof Shield
    desc: string
    color: string
  }[] = [
    {
      value: 'admin',
      label: 'Admin',
      icon: Shield,
      desc: 'Full control — manage menu, members, expenses & bills',
      color: '#f87171',
    },
    {
      value: 'representative',
      label: 'Representative',
      icon: Users,
      desc: 'Log meals, add expenses, manage daily operations',
      color: '#fbbf24',
    },
    {
      value: 'member',
      label: 'Member',
      icon: UserCheck,
      desc: 'View your meals, bills & budget',
      color: '#34d399',
    },
  ]

  return (
    <div className="auth-page">
      <div className="auth-container setup-container">
        <div className="auth-header">
          <div className="auth-logo">
            <UtensilsCrossed size={40} />
          </div>
          <h1>Complete Your Profile</h1>
          <p>
            Welcome, <strong>{user.displayName}</strong>! Just a few details
            to get started.
          </p>
        </div>

        {user.photoURL && (
          <div className="setup-avatar-row">
            <img
              src={user.photoURL}
              alt={user.displayName || 'Avatar'}
              className="setup-avatar"
              referrerPolicy="no-referrer"
            />
            <span className="setup-email">{user.email}</span>
          </div>
        )}

        <div className="auth-form">
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input
              type="text"
              className="form-input"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Full Name"
              id="setup-name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select Your Role</label>
            <div className="role-selector-vertical">
              {roles.filter(r => r.value !== 'admin' || isAdminAllowed).map(r => (
                <button
                  key={r.value}
                  type="button"
                  className={`role-option-v ${role === r.value ? 'active' : ''}`}
                  onClick={() => setRole(r.value)}
                  id={`setup-role-${r.value}`}
                  style={
                    { '--role-color': r.color } as React.CSSProperties
                  }
                >
                  <div className="role-option-icon">
                    <r.icon size={22} />
                  </div>
                  <div className="role-option-text">
                    <span className="role-option-label">{r.label}</span>
                    <span className="role-option-desc">{r.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {!isAdminAllowed && role === 'member' && (
            <div className="form-group">
              <label className="form-label">Invite PIN Code</label>
              <input
                type="text"
                className="form-input"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="4-digit PIN from your representative"
                maxLength={4}
              />
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            onClick={handleSubmit}
            disabled={submitting}
            id="setup-submit"
          >
            <Rocket size={18} />
            {submitting ? 'Setting up...' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  )
}
