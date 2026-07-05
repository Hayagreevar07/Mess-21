import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { CreditCard, Plus, Check, Clock, Utensils, Receipt, ChevronLeft, ChevronRight, CheckCircle2, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

interface Settlement {
  member: any;
  mealTotal: number;
  mealBreakdown: Record<string, { qty: number, total: number }>;
  expenseShare: number;
  manualBills: any[];
  manualTotalOwed: number;
  manualTotalPaid: number;
  transactionPayments: number;
  totalOwed: number;
  totalPaid: number;
  remaining: number;
}

export default function BillsPage() {
  const { profile, role } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [modalOpen, setModalOpen] = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  
  const [form, setForm] = useState({
    member_id: '',
    amount: '',
    due_date: '',
  })

  useEffect(() => {
    fetchData()
  }, [selectedMonth, profile])

  const fetchData = async () => {
    if (!profile) return
    setLoading(true)

    // 1. Members for this user
    let memberQuery = supabase.from('profiles').select('*').order('full_name')
    if (role === 'representative') {
      memberQuery = memberQuery.or(`rep_id.eq.${profile.id},id.eq.${profile.id}`)
    } else if (role === 'member') {
      memberQuery = memberQuery.eq('id', profile.id)
    }
    const { data: memberData } = await memberQuery
    const membersList = memberData || []
    const memberIds = membersList.map(m => m.id)

    // 2. Date ranges
    const startOfMonth = `${selectedMonth}-01`
    const d = new Date(`${selectedMonth}-01`)
    d.setMonth(d.getMonth() + 1)
    d.setDate(0)
    const endOfMonth = d.toISOString().split('T')[0]

    // 3. Fetch Meal Logs
    const { data: mealData } = await supabase
      .from('meal_logs')
      .select('member_id, date, quantity, menu_item:menu_items(name, price)')
      .in('member_id', memberIds)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    // 4. Fetch Expenses & Calculate Share
    const { data: expenseData } = await supabase
      .from('expenses')
      .select('amount, added_by_profile:profiles!expenses_added_by_fkey(role)')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      
    const messExpenses = (expenseData || []).filter((e: any) => e.added_by_profile?.role !== 'member')
    const totalMessExpenses = messExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    
    const { count: totalActiveMembers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      
    const expenseShare = totalActiveMembers ? totalMessExpenses / totalActiveMembers : 0

    // 5. Fetch Manual Due Bills
    const { data: billsData } = await supabase
      .from('due_bills')
      .select('*')
      .in('member_id', memberIds)
      .eq('month', selectedMonth)

    // 6. Fetch Transactions (Payments)
    // We look for completed mess_bill transactions where the description contains the selectedMonth
    const { data: txData } = await supabase
      .from('transactions')
      .select('from_id, amount')
      .in('from_id', memberIds)
      .eq('type', 'mess_bill')
      .eq('status', 'completed')
      .like('description', `%${selectedMonth}%`)

    // Aggregate into Settlements
    const settlementMap: Record<string, Settlement> = {}
    membersList.forEach(m => {
      settlementMap[m.id] = {
        member: m,
        mealTotal: 0,
        mealBreakdown: {},
        expenseShare: expenseShare,
        manualBills: [],
        manualTotalOwed: 0,
        manualTotalPaid: 0,
        transactionPayments: 0,
        totalOwed: 0,
        totalPaid: 0,
        remaining: 0
      }
    })

    // Add meals
    ;(mealData || []).forEach((log: any) => {
      if (!log.menu_item) return
      const s = settlementMap[log.member_id]
      if (s) {
        const price = log.menu_item.price || 0
        const itemName = log.menu_item.name || 'Unknown'
        const cost = log.quantity * price
        
        if (!s.mealBreakdown[itemName]) s.mealBreakdown[itemName] = { qty: 0, total: 0 }
        s.mealBreakdown[itemName].qty += log.quantity
        s.mealBreakdown[itemName].total += cost
        s.mealTotal += cost
      }
    })

    // Add manual bills
    ;(billsData || []).forEach((bill: any) => {
      const s = settlementMap[bill.member_id]
      if (s) {
        s.manualBills.push(bill)
        if (bill.is_paid) s.manualTotalPaid += Number(bill.amount)
        else s.manualTotalOwed += Number(bill.amount)
      }
    })

    // Add transaction payments
    ;(txData || []).forEach((tx: any) => {
      const s = settlementMap[tx.from_id]
      if (s) {
        s.transactionPayments += Number(tx.amount)
      }
    })

    // Calculate totals
    Object.values(settlementMap).forEach(s => {
      s.totalOwed = s.mealTotal + s.expenseShare + s.manualTotalOwed + s.manualTotalPaid
      s.totalPaid = s.manualTotalPaid + s.transactionPayments
      s.remaining = s.totalOwed - s.totalPaid
    })

    const finalSettlements = Object.values(settlementMap).sort((a, b) => b.totalOwed - a.totalOwed)
    setSettlements(finalSettlements)
    setMembers(membersList)
    setLoading(false)
  }

  const changeMonth = (delta: number) => {
    const d = new Date(`${selectedMonth}-01`)
    d.setMonth(d.getMonth() + delta)
    setSelectedMonth(d.toISOString().slice(0, 7))
  }

  const handleAddBill = async () => {
    if (!form.member_id || !form.amount || !form.due_date) return toast.error('Fill all fields')
    const { error } = await supabase.from('due_bills').insert({
      member_id: form.member_id,
      amount: parseFloat(form.amount),
      month: selectedMonth,
      due_date: form.due_date,
    })
    if (error) return toast.error(error.message)
    toast.success('Bill added!')
    setModalOpen(false)
    setForm({ member_id: '', amount: '', due_date: '' })
    fetchData()
  }

  const markManualPaid = async (id: string) => {
    const { error } = await supabase
      .from('due_bills')
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Marked as paid!')
    fetchData()
  }

  const handleRecordPayment = async () => {
    if (!selectedSettlement || !paymentAmount) return
    const amt = parseFloat(paymentAmount)
    if (isNaN(amt) || amt <= 0) return toast.error('Enter valid amount')

    const isRep = role === 'representative' || role === 'admin'
    const fromId = selectedSettlement.member.id
    const toId = isRep ? profile?.id : (profile?.rep_id || profile?.id)

    const { error } = await supabase.from('transactions').insert({
      from_id: fromId,
      to_id: toId,
      amount: amt,
      type: 'mess_bill',
      description: `Settlement for ${selectedMonth}`,
      status: isRep ? 'completed' : 'pending' 
    })

    if (error) return toast.error(error.message)
    toast.success(isRep ? 'Payment recorded!' : 'Payment request sent!')
    setPayModalOpen(false)
    setPaymentAmount('')
    fetchData()
  }

  const openPaymentModal = (s: Settlement) => {
    setSelectedSettlement(s)
    setPaymentAmount(s.remaining.toString())
    setPayModalOpen(true)
  }

  const groupTotalOwed = settlements.reduce((sum, s) => sum + s.totalOwed, 0)
  const groupTotalPaid = settlements.reduce((sum, s) => sum + s.totalPaid, 0)
  const groupRemaining = settlements.reduce((sum, s) => sum + Math.max(0, s.remaining), 0)

  return (
    <div className="page bills-page">
      <div className="page-header">
        <div>
          <h1>Settlements</h1>
          <p className="page-subtitle">Unified view of meals, expenses, and bills</p>
        </div>
        {(role === 'admin' || role === 'representative') && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} /> Manual Bill
          </button>
        )}
      </div>

      <div className="meal-controls" style={{ marginBottom: '20px' }}>
        <div className="date-navigator" style={{ margin: '0 auto' }}>
          <button className="btn-icon" onClick={() => changeMonth(-1)}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontWeight: 'bold', minWidth: '100px', textAlign: 'center' }}>
            {new Date(`${selectedMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <button className="btn-icon" onClick={() => changeMonth(1)}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {(role === 'admin' || role === 'representative') && (
        <div className="card glass-card" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', padding: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-light)' }}>Group Summary</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{settlements.length} members for {selectedMonth}</p>
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Owed</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-light)' }}>₹{groupTotalOwed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Collected</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary-light)' }}>₹{groupTotalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Remaining</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--warning)' }}>₹{groupRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loader">
          <div className="loader"><div className="loader-ring"></div><div className="loader-ring"></div></div>
        </div>
      ) : settlements.length === 0 ? (
        <div className="empty-state">
          <CreditCard size={48} />
          <p>No data for this month</p>
        </div>
      ) : (
        <div className="bills-list" style={{ display: 'grid', gap: '16px' }}>
          {settlements.map(s => (
            <div key={s.member.id} className="card tilt-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-light)' }}>{s.member.full_name}</h3>
                  <span className="badge" style={{ marginTop: '8px' }}>
                    {s.remaining <= 0 ? (
                      <><CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }}/> Settled</>
                    ) : (
                      <><Clock size={12} style={{ display: 'inline', marginRight: '4px' }}/> Pending</>
                    )}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Remaining Balance</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: s.remaining > 0 ? 'var(--warning)' : 'var(--primary)' }}>
                    ₹{Math.max(0, s.remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  {s.remaining > 0 && (
                    <button className="btn btn-sm btn-primary" style={{ marginTop: '8px' }} onClick={() => openPaymentModal(s)}>
                      <DollarSign size={14} /> Pay Balance
                    </button>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div style={{ display: 'grid', gap: '12px', fontSize: '0.9rem' }}>
                
                {/* Meals */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '6px', borderRadius: '8px', color: 'var(--primary)' }}><Utensils size={14} /></div>
                    <span>Meal Bill</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>₹{s.mealTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                {Object.keys(s.mealBreakdown).length > 0 && (
                  <div style={{ marginLeft: '34px', paddingLeft: '12px', borderLeft: '2px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {Object.entries(s.mealBreakdown).map(([itemName, data]) => (
                      <div key={itemName} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                        <span>{itemName} × {data.qty}</span>
                        <span>₹{data.total}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expense Share */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '6px', borderRadius: '8px', color: 'var(--warning)' }}><Receipt size={14} /></div>
                    <span>Mess Expense Share</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>₹{s.expenseShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>

                {/* Manual Bills */}
                {s.manualBills.map(bill => (
                  <div key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ background: 'rgba(6, 182, 212, 0.2)', padding: '6px', borderRadius: '8px', color: '#06b6d4' }}><CreditCard size={14} /></div>
                      <span>Manual Bill {bill.is_paid ? '(Paid)' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600 }}>₹{Number(bill.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      {!bill.is_paid && (
                        <button className="btn-icon btn-success" style={{ width: '24px', height: '24px' }} onClick={() => markManualPaid(bill.id)} title="Mark Paid">
                          <Check size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

              </div>
              
              {/* Payment History */}
              {s.totalPaid > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary-light)' }}>
                    <span>Total Paid So Far</span>
                    <span style={{ fontWeight: 'bold' }}>- ₹{s.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Manual Bill Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Add Bill for ${selectedMonth}`}>
        <div className="modal-form">
          <div className="form-group">
            <label className="form-label">Member</label>
            <select className="form-input" value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })}>
              <option value="">Select Member</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input type="number" className="form-input" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input type="date" className="form-input" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <button className="btn btn-primary btn-full" onClick={handleAddBill}>Add Bill</button>
        </div>
      </Modal>

      {/* Record Payment Modal */}
      <Modal isOpen={payModalOpen} onClose={() => setPayModalOpen(false)} title={`Record Payment`}>
        {selectedSettlement && (
          <div className="modal-form">
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
              Record a payment for <strong>{selectedSettlement.member.full_name}</strong> towards their {selectedMonth} settlement.
            </p>
            <div className="form-group">
              <label className="form-label">Payment Amount (₹)</label>
              <input type="number" className="form-input" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} max={selectedSettlement.remaining} />
            </div>
            <button className="btn btn-primary btn-full" onClick={handleRecordPayment}>
              {role === 'member' ? 'Send Payment Request' : 'Confirm Payment'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
