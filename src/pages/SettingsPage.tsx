import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Settings, Save, Users, Shield, UserCheck, UserMinus } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Role } from '../lib/types'

export default function SettingsPage() {
  const { profile } = useAuth()
  const [messName, setMessName] = useState('My Mess')
  const [startDay, setStartDay] = useState(1)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const [{ data: settings }, { data: memberData }] = await Promise.all([
      supabase.from('mess_settings').select('*').limit(1).single(),
      supabase.from('profiles').select('*').order('full_name'),
    ])
    if (settings) {
      setMessName(settings.mess_name)
      setStartDay(settings.monthly_start_day)
    }
    setMembers(memberData || [])
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

      <div className="settings-section glass-card">
        <h3>
          <Settings size={18} /> General Settings
        </h3>
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
    </div>
  )
}
