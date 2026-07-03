import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Profile, Invitation } from '../lib/types'
import { Users, Mail, Plus, Key, Copy, CheckCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'

export default function MembersPage() {
  const { profile } = useAuth()
  const [members, setMembers] = useState<Profile[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'representative'>('member')
  const [submitting, setSubmitting] = useState(false)

  const isPrivileged = profile?.role === 'admin' || profile?.role === 'representative'

  useEffect(() => {
    if (isPrivileged) {
      fetchData()
    }
  }, [profile])

  const fetchData = async () => {
    try {
      let profilesQuery = supabase.from('profiles').select('*').order('full_name')
      let invitesQuery = supabase.from('invitations').select('*, creator:profiles!invitations_created_by_fkey(full_name)').order('created_at', { ascending: false })

      if (profile?.role === 'representative') {
        profilesQuery = profilesQuery.or(`rep_id.eq.${profile.id},id.eq.${profile.id}`)
        invitesQuery = invitesQuery.eq('created_by', profile.id)
      }

      const [membersRes, invitesRes] = await Promise.all([
        profilesQuery,
        invitesQuery
      ])
      
      if (membersRes.error) throw membersRes.error
      if (invitesRes.error) throw invitesRes.error

      setMembers(membersRes.data as Profile[])
      setInvitations(invitesRes.data as Invitation[])
    } catch (err) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return toast.error('Email is required')

    setSubmitting(true)
    const pin = Math.floor(1000 + Math.random() * 9000).toString() // Generate 4 digit PIN
    
    try {
      const { error } = await supabase.from('invitations').insert({
        email: inviteEmail.trim().toLowerCase(),
        pin_code: pin,
        role: inviteRole,
        created_by: profile?.id
      })

      if (error) throw error
      
      toast.success(`Generated PIN: ${pin}`)
      setIsModalOpen(false)
      setInviteEmail('')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate invite')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelInvite = async (id: string) => {
    if (!confirm('Cancel this invitation?')) return
    
    try {
      const { error } = await supabase.from('invitations').delete().eq('id', id)
      if (error) throw error
      toast.success('Invitation cancelled')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invitation')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('PIN copied to clipboard')
  }

  if (!isPrivileged) {
    return <div className="page-container"><p>Access denied.</p></div>
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Manage Members</h1>
          <p className="page-subtitle">Invite new members and representatives securely</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          New Invite
        </button>
      </header>

      {loading ? (
        <div className="skeleton" style={{ height: '300px', borderRadius: '16px' }}></div>
      ) : (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Active Invitations */}
          <div className="card tilt-card">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} /> Active Invitations
            </h3>
            {invitations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No pending invitations.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {invitations.map(inv => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--text-light)' }}>{inv.email}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Role: {inv.role} • Status: {inv.status}</div>
                    </div>
                    {inv.status === 'pending' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 12px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '2px' }}>
                          {inv.pin_code}
                        </div>
                        <button className="btn-icon" onClick={() => copyToClipboard(inv.pin_code)} title="Copy PIN">
                          <Copy size={16} />
                        </button>
                        <button className="btn-icon btn-danger" onClick={() => handleCancelInvite(inv.id)} title="Cancel Invite">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                        <CheckCircle size={12} style={{ display: 'inline', marginRight: '4px' }}/> Accepted
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Members */}
          <div className="card tilt-card">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} /> Directory
            </h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.full_name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {m.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-light)' }}>{m.full_name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={12} /> {m.email}
                    </div>
                  </div>
                  <span className={`badge`} style={{ textTransform: 'capitalize' }}>
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Invite User">
        <form onSubmit={handleGenerateInvite}>
          <div className="form-group">
            <label className="form-label">Gmail Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="user@gmail.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Assign Role</label>
            <select
              className="form-input"
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'member' | 'representative')}
            >
              <option value="member">Member</option>
              {profile?.role === 'admin' && <option value="representative">Representative</option>}
            </select>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              We will generate a 4-digit PIN. You must send this PIN to the user securely.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
              Generate PIN
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
