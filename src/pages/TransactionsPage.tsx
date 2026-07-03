import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Profile, Transaction } from '../lib/types'
import { ArrowRightLeft, Plus, CheckCircle, XCircle, Clock, Send, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'

export default function TransactionsPage() {
  const { profile, role } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [txType, setTxType] = useState<'lend' | 'repay'>('lend')
  const [amount, setAmount] = useState('')
  const [targetId, setTargetId] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [profile])

  const fetchData = async () => {
    try {
      let membersQuery = supabase.from('profiles').select('*').neq('id', profile?.id).order('full_name')
      
      if (role === 'member' && profile?.rep_id) {
        membersQuery = membersQuery.eq('rep_id', profile!.rep_id)
      } else if (role === 'representative') {
        membersQuery = membersQuery.eq('rep_id', profile!.id)
      }

      const [txRes, membersRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, from_profile:profiles!transactions_from_id_fkey(full_name), to_profile:profiles!transactions_to_id_fkey(full_name)')
          .or(`from_id.eq.${profile?.id},to_id.eq.${profile?.id}`)
          .order('created_at', { ascending: false }),
        membersQuery
      ])

      if (txRes.error) throw txRes.error
      if (membersRes.error) throw membersRes.error

      setTransactions(txRes.data as Transaction[])
      setMembers(membersRes.data as Profile[])
    } catch (err) {
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !targetId) return toast.error('Amount and Member are required')

    setSubmitting(true)
    try {
      // If lending, I am sending money TO someone. (from_id = me, to_id = them)
      // If repaying, I am sending money TO someone for a debt. (from_id = me, to_id = them)
      // But we can also request money. Let's keep it simple: I am initiating the send.
      
      const { error } = await supabase.from('transactions').insert({
        from_id: profile?.id,
        to_id: targetId,
        amount: parseFloat(amount),
        type: txType,
        description: description.trim(),
        status: 'pending' // The other person has to accept it
      })

      if (error) throw error
      
      toast.success('Transaction sent!')
      setIsModalOpen(false)
      setAmount('')
      setDescription('')
      setTargetId('')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to send transaction')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: 'completed' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error
      toast.success(`Transaction ${newStatus}`)
      fetchData()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Peer Finance</h1>
          <p className="page-subtitle">Track money lent and received between members</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          New Transaction
        </button>
      </header>

      {loading ? (
        <div className="skeleton" style={{ height: '300px', borderRadius: '16px' }}></div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <ArrowRightLeft size={48} className="empty-icon" />
          <h3>No Transactions</h3>
          <p>You haven't sent or received any money yet.</p>
        </div>
      ) : (
        <div className="card-grid">
          {transactions.map(tx => {
            const isSender = tx.from_id === profile?.id
            const counterparty = isSender ? tx.to_profile?.full_name : tx.from_profile?.full_name
            
            return (
              <div key={tx.id} className="card tilt-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isSender ? (
                      <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '8px', borderRadius: '50%', color: '#ef4444' }}><Send size={16} /></div>
                    ) : (
                      <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '8px', borderRadius: '50%', color: '#10b981' }}><Download size={16} /></div>
                    )}
                    <div>
                      <div style={{ fontWeight: '600' }}>{isSender ? `Sent to ${counterparty}` : `Received from ${counterparty}`}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.type.toUpperCase()}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: isSender ? '#ef4444' : '#10b981' }}>
                    {isSender ? '-' : '+'}₹{tx.amount}
                  </div>
                </div>

                {tx.description && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                    "{tx.description}"
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="badge" style={{
                    backgroundColor: tx.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : tx.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: tx.status === 'pending' ? '#f59e0b' : tx.status === 'completed' ? '#10b981' : '#ef4444',
                  }}>
                    {tx.status === 'pending' ? <Clock size={12} style={{ display: 'inline', marginRight: '4px' }}/> : null}
                    {tx.status.toUpperCase()}
                  </span>

                  {/* If I am the receiver and it's pending, I can accept or reject */}
                  {!isSender && tx.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-icon btn-danger" onClick={() => handleUpdateStatus(tx.id, 'rejected')} title="Reject">
                        <XCircle size={16} />
                      </button>
                      <button className="btn-icon btn-success" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }} onClick={() => handleUpdateStatus(tx.id, 'completed')} title="Accept">
                        <CheckCircle size={16} />
                      </button>
                    </div>
                  )}
                  {/* If I am the sender, I just see the date */}
                  {(isSender || tx.status !== 'pending') && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Send Money / Lend">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Transaction Type</label>
            <select className="form-input" value={txType} onChange={e => setTxType(e.target.value as any)}>
              <option value="lend">Lend Money</option>
              <option value="repay">Repay Debt</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Send To</label>
            <select className="form-input" value={targetId} onChange={e => setTargetId(e.target.value)} required>
              <option value="">Select Member</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500" required />
          </div>
          <div className="form-group">
            <label className="form-label">Note (Optional)</label>
            <input type="text" className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Dinner share" />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>Send</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
