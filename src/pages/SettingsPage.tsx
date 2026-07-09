import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Settings, Save, Users, Shield, UserCheck, UserMinus, DownloadCloud, RefreshCw, Database } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Role } from '../lib/types'

const APP_VERSION = 'v2.0.2'

export default function SettingsPage() {
  const { profile } = useAuth()
  const [messName, setMessName] = useState('My Mess')
  const [startDay, setStartDay] = useState(1)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle')
  const [latestRelease, setLatestRelease] = useState<any>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    if (profile?.role === 'admin') {
      const [{ data: settings }, { data: memberData }] = await Promise.all([
        supabase.from('mess_settings').select('*').limit(1).single(),
        supabase.from('profiles').select('*').order('full_name'),
      ])
      if (settings) {
        setMessName(settings.mess_name)
        setStartDay(settings.monthly_start_day)
      }
      setMembers(memberData || [])
    }
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('mess_settings')
      .update({ mess_name: messName, monthly_start_day: startDay })
      .not('id', 'is', null)
    if (error) toast.error(error.message)
    else toast.success('Settings saved!')
    setSaving(false)
  }

  const updateRole = async (userId: string, newRole: Role) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
    if (error) return toast.error(error.message)
    toast.success('Role updated!')
    fetchSettings()
  }

  const removeMember = async (userId: string) => {
    if (!confirm('Remove this member? This cannot be undone.')) return
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)
    if (error) return toast.error(error.message)
    toast.success('Member removed!')
    fetchSettings()
  }

  const saveProfile = async () => {
    if (!fullName.trim()) return toast.error('Name cannot be empty')
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile?.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Profile updated!')
      setTimeout(() => window.location.reload(), 1000)
    }
    setSaving(false)
  }

  const deleteAccount = async () => {
    if (!confirm('Are you SURE you want to delete your account? This will log you out and delete your profile.')) return
    
    // We only delete from 'profiles'. Firebase Auth user deletion requires client SDK re-auth.
    // For now, removing from profiles makes the user lose access.
    const { error } = await supabase.from('profiles').delete().eq('id', profile?.id)
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Account deleted.')
      window.location.reload()
    }
  }

  const roleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return Shield
      case 'representative':
        return Users
      default:
        return UserCheck
    }
  }

  const checkForUpdates = async () => {
    setUpdateStatus('checking')
    try {
      const res = await fetch('https://api.github.com/repos/Hayagreevar07/Mess-21/releases/latest')
      if (!res.ok) throw new Error('No releases found')
      const data = await res.json()
      
      // Simple string comparison for versions
      if (data.tag_name && data.tag_name !== APP_VERSION) {
        setLatestRelease(data)
        setUpdateStatus('available')
      } else {
        setUpdateStatus('up-to-date')
      }
    } catch (error) {
      console.error(error)
      setUpdateStatus('error')
      toast.error('Failed to check for updates.')
    }
  }

  const exportData = async () => {
    try {
      const toastId = toast.loading('Exporting data...')
      
      const [
        { data: profiles },
        { data: meals },
        { data: expenses },
        { data: bills },
        { data: transactions }
      ] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('meal_logs').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('due_bills').select('*'),
        supabase.from('transactions').select('*')
      ])

      const backup = {
        timestamp: new Date().toISOString(),
        profiles,
        meals,
        expenses,
        bills,
        transactions
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mess_backup_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      toast.success('Backup exported successfully!', { id: toastId })
    } catch (error: any) {
      toast.error('Failed to export data: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="page-loader">
        <div className="loader">
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
          <div className="loader-ring"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="page settings-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-subtitle">Configure your mess</p>
        </div>
      </div>

      {profile?.role === 'admin' && (
      <div className="settings-section glass-card">
        <h3>
          <Settings size={18} /> General Settings
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Manage your mess name and billing cycle. The billing cycle start day determines when monthly summaries reset.
        </p>
        <div className="form-group">
          <label className="form-label">Mess Name</label>
          <input
            type="text"
            className="form-input"
            value={messName}
            onChange={e => setMessName(e.target.value)}
            id="settings-mess-name"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Monthly Billing Start Day</label>
          <input
            type="number"
            className="form-input"
            min={1}
            max={28}
            value={startDay}
            onChange={e => setStartDay(Number(e.target.value))}
            id="settings-start-day"
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={saveSettings}
          disabled={saving}
          id="settings-save-btn"
        >
          <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
      )}

      {profile?.role === 'admin' && (
      <div className="settings-section glass-card">
        <h3>
          <Users size={18} /> Members ({members.length})
        </h3>
        <div className="members-list">
          {members.map(member => {
            const Icon = roleIcon(member.role)
            return (
              <div key={member.id} className="member-card">
                <div className="member-avatar">
                  {member.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="member-info">
                  <span className="member-name">
                    {member.full_name}{' '}
                    {member.id === profile?.id ? '(You)' : ''}
                  </span>
                  <span className={`role-badge role-${member.role}`}>
                    <Icon size={12} /> {member.role}
                  </span>
                </div>
                {member.id !== profile?.id && (
                  <div className="member-actions">
                    <select
                      className="form-input form-input-sm"
                      value={member.role}
                      onChange={e =>
                        updateRole(member.id, e.target.value as Role)
                      }
                    >
                      <option value="admin">Admin</option>
                      <option value="representative">Representative</option>
                      <option value="member">Member</option>
                    </select>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => removeMember(member.id)}
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      )}

      {profile?.role === 'admin' && (
      <div className="settings-section glass-card" style={{ marginTop: '24px' }}>
        <h3>
          <Database size={18} /> Data & Backups
        </h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Download a complete snapshot of all mess data (members, meals, expenses, bills, and transactions) as a JSON file.
        </p>
        <button
          className="btn btn-primary"
          onClick={exportData}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <DownloadCloud size={16} /> Export All Data
        </button>
      </div>
      )}

      {/* My Profile Section (For everyone) */}
      <div className="settings-section glass-card" style={{ marginTop: '24px' }}>
        <h3>
          <UserCheck size={18} /> My Profile
        </h3>
        
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            className="form-input"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={saveProfile}
          disabled={saving}
          style={{ marginBottom: '24px' }}
        >
          <Save size={16} /> Update Profile
        </button>

        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <h4 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Danger Zone</h4>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Deleting your account will remove your profile and access to the mess.
          </p>
          <button
            className="btn btn-danger"
            onClick={deleteAccount}
          >
            <UserMinus size={16} /> Delete My Account
          </button>
        </div>
      </div>

      {/* App Updates Section */}
      <div className="settings-section glass-card" style={{ marginTop: '24px' }}>
        <h3>
          <DownloadCloud size={18} /> App Updates
        </h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ color: 'var(--text-light)', fontWeight: 500 }}>Current Version: {APP_VERSION}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {updateStatus === 'checking' && 'Checking for latest version...'}
              {updateStatus === 'up-to-date' && 'You are on the latest version!'}
              {updateStatus === 'error' && 'Could not fetch updates.'}
              {updateStatus === 'available' && `New version available: ${latestRelease?.tag_name}`}
            </div>
          </div>
          
          {updateStatus === 'available' ? (
            <a 
              href={latestRelease?.assets?.[0]?.browser_download_url || latestRelease?.html_url} 
              target="_blank" 
              rel="noreferrer"
              className="btn btn-success"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <DownloadCloud size={16} /> Download Update
            </a>
          ) : (
            <button 
              className="btn btn-secondary" 
              onClick={checkForUpdates}
              disabled={updateStatus === 'checking'}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={16} className={updateStatus === 'checking' ? 'spin' : ''} /> Check for Updates
            </button>
          )}
        </div>
      </div>

      {/* Ownership & Security Badge */}
      <div style={{
        marginTop: '32px',
        padding: '16px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        opacity: 0.8
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
          <Shield size={20} />
          <span style={{ fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Securely Owned & Developed</span>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
          This application and its intellectual property are exclusively owned by <strong>Hayagreevar07</strong>.
        </p>
      </div>
    </div>
  )
}
