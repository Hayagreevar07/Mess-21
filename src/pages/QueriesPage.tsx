import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { SupportQuery } from '../lib/types'
import { MessageSquare, Plus, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'

export default function QueriesPage() {
  const { profile } = useAuth()
  const [queries, setQueries] = useState<SupportQuery[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isMember = profile?.role === 'member'

  useEffect(() => {
    fetchQueries()
  }, [profile])

  const fetchQueries = async () => {
    try {
      let query = supabase
        .from('queries')
        .select(`
          *,
          member:profiles!queries_member_id_fkey(id, full_name, role),
          resolver:profiles!queries_resolved_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false })

      // Members only see their own queries
      if (isMember && profile) {
        query = query.eq('member_id', profile.id)
      }

      const { data, error } = await query
      if (error) throw error
      setQueries(data as SupportQuery[])
    } catch (err: any) {
      toast.error('Failed to load queries')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) {
      return toast.error('Subject and description are required')
    }
    
    setSubmitting(true)
    try {
      const { error } = await supabase.from('queries').insert({
        member_id: profile?.id,
        subject: subject.trim(),
        description: description.trim(),
        status: 'open'
      })

      if (error) throw error
      
      toast.success('Query submitted successfully')
      setIsModalOpen(false)
      setSubject('')
      setDescription('')
      fetchQueries()
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit query')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolve = async (queryId: string) => {
    try {
      const { error } = await supabase
        .from('queries')
        .update({
          status: 'resolved',
          resolved_by: profile?.id,
          resolved_at: new Date().toISOString()
        })
        .eq('id', queryId)

      if (error) throw error
      toast.success('Query marked as resolved')
      fetchQueries()
    } catch (err: any) {
      toast.error('Failed to resolve query')
    }
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Support & Queries</h1>
          <p className="page-subtitle">
            {isMember ? 'Raise issues like meal mismatches directly to reps' : 'Manage and resolve member queries'}
          </p>
        </div>
        {isMember && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Raise Query
          </button>
        )}
      </header>

      {loading ? (
        <div className="skeleton" style={{ height: '200px', borderRadius: '16px' }}></div>
      ) : queries.length === 0 ? (
        <div className="empty-state">
          <MessageSquare size={48} className="empty-icon" />
          <h3>No Queries Yet</h3>
          <p>
            {isMember 
              ? "You haven't raised any queries. Everything looks good!" 
              : "No pending issues from members."}
          </p>
        </div>
      ) : (
        <div className="card-grid">
          {queries.map(q => (
            <div key={q.id} className="card tilt-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-light)' }}>{q.subject}</h3>
                <span 
                  className="badge" 
                  style={{ 
                    backgroundColor: q.status === 'open' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: q.status === 'open' ? '#fbbf24' : '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {q.status === 'open' ? <Clock size={12} /> : <CheckCircle size={12} />}
                  {q.status.toUpperCase()}
                </span>
              </div>
              
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px', flex: 1, whiteSpace: 'pre-wrap' }}>
                {q.description}
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                <div>
                  {!isMember && <div>By: <strong style={{color: 'var(--text-light)'}}>{q.member?.full_name}</strong></div>}
                  <div>{new Date(q.created_at).toLocaleDateString()}</div>
                </div>
                
                {q.status === 'open' && !isMember && (
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    onClick={() => handleResolve(q.id)}
                  >
                    Resolve
                  </button>
                )}
                
                {q.status === 'resolved' && (
                  <div style={{ textAlign: 'right' }}>
                    <div>Resolved by {q.resolver?.full_name || 'Admin'}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Raise a Query">
        <form onSubmit={handleSubmitQuery}>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Meal Mismatch on 3rd July"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Query'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
