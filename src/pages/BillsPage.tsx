import { useEffect, useState } from 'react'
import { getLocalDateString, getLocalMonthString } from '../lib/dateUtils'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { CreditCard, Plus, Check, Clock, Utensils, Receipt, ChevronLeft, ChevronRight, CheckCircle2, DollarSign, Bell } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

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
  const [selectedMonth, setSelectedMonth] = useState(getLocalMonthString())
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'settled'>('all')
  const [viewType, setViewType] = useState<'group' | 'my'>('group')
  
  const [modalOpen, setModalOpen] = useState(false)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
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
    const [year, month] = selectedMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const endOfMonth = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`

    // 3. Fetch Meal Logs
    let mealQuery = supabase
      .from('meal_logs')
      .select('member_id, date, quantity, menu_item:menu_items(name, price)')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    if (role !== 'admin') {
      mealQuery = mealQuery.in('member_id', memberIds)
    }
    const { data: mealData } = await mealQuery

    // 4. Fetch Expenses & Calculate Share
    const groupId = profile?.rep_id || profile?.id
    
    let expenseQuery = supabase
      .from('expenses')
      .select('amount, split_type')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      
    expenseQuery = expenseQuery.or(`added_by.eq.${profile.id},and(split_type.eq.rep_group,rep_id.eq.${groupId})`)

    const { data: expenseData } = await expenseQuery
      
    const messExpenses = (expenseData || []).filter((e: any) => e.split_type !== 'personal')
    const totalMessExpenses = messExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    
    let countQuery = supabase.from('profiles').select('*', { count: 'exact', head: true })
    countQuery = countQuery.or(`id.eq.${groupId},rep_id.eq.${groupId}`)

    const { count: totalActiveMembers } = await countQuery
      
    const expenseShare = totalActiveMembers ? totalMessExpenses / totalActiveMembers : 0

    // 5. Fetch Manual Due Bills
    let billsQuery = supabase
      .from('due_bills')
      .select('*')
      .eq('month', selectedMonth)

    if (role !== 'admin') {
      billsQuery = billsQuery.in('member_id', memberIds)
    }
    const { data: billsData } = await billsQuery

    // 6. Fetch Transactions (Payments)
    // We look for completed mess_bill transactions where the description contains the selectedMonth
    let txQuery = supabase
      .from('transactions')
      .select('from_id, amount')
      .eq('type', 'mess_bill')
      .eq('status', 'completed')
      .like('description', `%${selectedMonth}%`)

    if (role !== 'admin') {
      txQuery = txQuery.in('from_id', memberIds)
    }
    const { data: txData } = await txQuery

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
      const menuItem = Array.isArray(log.menu_item) ? log.menu_item[0] : log.menu_item;
      if (!menuItem) return
      const s = settlementMap[log.member_id]
      if (s) {
        const price = Number(menuItem.price) || 0
        const itemName = menuItem.name || 'Unknown'
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
    const [year, month] = selectedMonth.split('-').map(Number)
    const newDate = new Date(year, month - 1 + delta, 1)
    setSelectedMonth(getLocalMonthString(newDate))
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

  const handleSendReminder = async (s: Settlement) => {
    if (s.remaining <= 0) return toast.error('Balance is already settled')
    
    // Create a high-priority task for the member
    const { error } = await supabase.from('tasks').insert({
      title: `Pay Mess Bill (${selectedMonth}) - ₹${Math.max(0, s.remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      assigned_to: s.member.id,
      due_date: getLocalDateString(),
      status: 'todo'
    })
    
    if (error) return toast.error(error.message)
    toast.success(`Reminder sent to ${s.member.full_name}! 🔔`)
  }

  const openPaymentModal = (s: Settlement) => {
    setSelectedSettlement(s)
    setPaymentAmount(s.remaining.toString())
    setPayModalOpen(true)
  }

  const openInvoiceModal = (s: Settlement) => {
    setSelectedSettlement(s)
    setInvoiceModalOpen(true)
  }

  const groupTotalOwed = settlements.reduce((sum, s) => sum + s.totalOwed, 0)
  const groupTotalPaid = settlements.reduce((sum, s) => sum + s.totalPaid, 0)
  const groupRemaining = settlements.reduce((sum, s) => sum + Math.max(0, s.remaining), 0)

  let displayedSettlements = settlements
  if (role === 'representative' || role === 'admin') {
    if (viewType === 'my') {
      displayedSettlements = displayedSettlements.filter(s => s.member.id === profile?.id)
    }
  } else {
    // Regular members only ever see their own
    displayedSettlements = displayedSettlements.filter(s => s.member.id === profile?.id)
  }

  if (filter === 'pending') displayedSettlements = displayedSettlements.filter(s => s.remaining > 0)
  if (filter === 'settled') displayedSettlements = displayedSettlements.filter(s => s.remaining <= 0)

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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button 
            className={`category-tab ${viewType === 'group' ? 'active' : ''}`}
            onClick={() => setViewType('group')}
          >
            👥 Group Bills
          </button>
          <button 
            className={`category-tab ${viewType === 'my' ? 'active' : ''}`}
            onClick={() => setViewType('my')}
          >
            👤 My Bill
          </button>
        </div>
      )}

      {(role === 'admin' || role === 'representative') && viewType === 'group' && (
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
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button className={`badge ${filter === 'all' ? 'active' : ''}`} style={{ cursor: 'pointer', background: filter === 'all' ? 'var(--primary)' : 'var(--bg-glass-strong)' }} onClick={() => setFilter('all')}>All</button>
            <button className={`badge ${filter === 'pending' ? 'active' : ''}`} style={{ cursor: 'pointer', background: filter === 'pending' ? 'var(--warning)' : 'var(--bg-glass-strong)' }} onClick={() => setFilter('pending')}>Pending</button>
            <button className={`badge ${filter === 'settled' ? 'active' : ''}`} style={{ cursor: 'pointer', background: filter === 'settled' ? 'var(--success)' : 'var(--bg-glass-strong)' }} onClick={() => setFilter('settled')}>Settled</button>
          </div>

          <motion.div 
            className="bills-list" 
            style={{ display: 'grid', gap: '16px' }}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.05 }
              }
            }}
          >
            {displayedSettlements.map(s => (
              <motion.div 
                key={s.member.id} 
                className="card tilt-card" 
                style={{ padding: '20px' }}
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
              >
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
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                      {(role === 'admin' || role === 'representative') && (
                        <button className="btn-icon btn-secondary" style={{ padding: '4px 8px' }} onClick={() => handleSendReminder(s)} title="Send Reminder Task">
                          <Bell size={14} />
                        </button>
                      )}
                      <button className="btn btn-sm btn-primary" onClick={() => openPaymentModal(s)}>
                        <DollarSign size={14} /> Pay
                      </button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: s.remaining > 0 ? '8px' : '8px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => openInvoiceModal(s)} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                      <Receipt size={12} /> Invoice
                    </button>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div style={{ display: 'grid', gap: '12px', fontSize: '0.9rem' }}>
                
                {/* Meals */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '6px', borderRadius: '8px', color: 'var(--primary)' }}><Utensils size={14} /></div>
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>Meal Bill</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Up to today</span>
                    </span>
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
                    <span>Expense Share</span>
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
            </motion.div>
          ))}
        </motion.div>
        </>
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

      {/* Invoice Modal */}
      <Modal isOpen={invoiceModalOpen} onClose={() => setInvoiceModalOpen(false)} title={`Invoice - ${selectedMonth}`}>
        {selectedSettlement && (
          <div>
            <div id="invoice-print-area" style={{ background: '#fff', color: '#000', padding: '24px', borderRadius: '8px', fontFamily: 'monospace' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '16px', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Scheward Mess</h2>
                  <p style={{ margin: 0, color: '#555' }}>Official Settlement Invoice</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0 }}><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                  <p style={{ margin: 0 }}><strong>Bill Month:</strong> {selectedMonth}</p>
                </div>
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <p style={{ margin: 0 }}><strong>Billed To:</strong></p>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.2rem' }}>{selectedSettlement.member.full_name}</h3>
                <p style={{ margin: 0, color: '#555' }}>Role: {selectedSettlement.member.role}</p>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <th style={{ textAlign: 'left', padding: '8px 0' }}>Description</th>
                    <th style={{ textAlign: 'right', padding: '8px 0' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '8px 0' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selectedSettlement.mealBreakdown).map(([itemName, data]) => (
                    <tr key={itemName} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 0' }}>{itemName}</td>
                      <td style={{ textAlign: 'right', padding: '8px 0' }}>{data.qty}</td>
                      <td style={{ textAlign: 'right', padding: '8px 0' }}>₹{data.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  {selectedSettlement.expenseShare > 0 && (
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 0' }}>Shared Mess Expenses</td>
                      <td style={{ textAlign: 'right', padding: '8px 0' }}>-</td>
                      <td style={{ textAlign: 'right', padding: '8px 0' }}>₹{selectedSettlement.expenseShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  )}
                  {selectedSettlement.manualBills.map((bill, i) => (
                    <tr key={bill.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px 0' }}>Manual Bill #{i+1} {bill.is_paid ? '(Paid)' : ''}</td>
                      <td style={{ textAlign: 'right', padding: '8px 0' }}>-</td>
                      <td style={{ textAlign: 'right', padding: '8px 0' }}>₹{Number(bill.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #000', paddingTop: '16px', fontWeight: 'bold' }}>
                <span>Total Owed</span>
                <span>₹{selectedSettlement.totalOwed.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              {selectedSettlement.totalPaid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', color: '#555' }}>
                  <span>Total Paid</span>
                  <span>- ₹{selectedSettlement.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '8px', borderTop: '1px solid #ddd', fontSize: '1.2rem', fontWeight: 800 }}>
                <span>Remaining Balance</span>
                <span style={{ color: selectedSettlement.remaining > 0 ? '#d97706' : '#10b981' }}>
                  ₹{Math.max(0, selectedSettlement.remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>

              <div style={{ marginTop: '32px', textAlign: 'center', color: '#777', fontSize: '0.8rem', borderTop: '1px dashed #ccc', paddingTop: '16px' }}>
                <p>Thank you for using Scheward Mess System!</p>
              </div>
            </div>
            
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setInvoiceModalOpen(false)}>Close</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => window.print()}>Print / Save PDF</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
