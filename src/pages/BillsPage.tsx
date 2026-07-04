import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { CreditCard, Plus, Check, Clock, AlertCircle, Utensils } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BillsPage() {
  const { profile, role } = useAuth()
  const [bills, setBills] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    member_id: '',
    amount: '',
    month: new Date().toISOString().slice(0, 7),
    due_date: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const billQuery =
      role === 'member'
        ? supabase
            .from('due_bills')
            .select('*, member:profiles(full_name)')
            .eq('member_id', profile?.id)
            .order('due_date', { ascending: false })
        : supabase
            .from('due_bills')
            .select('*, member:profiles(full_name)')
            .order('due_date', { ascending: false })

    let memberQuery = supabase.from('profiles').select('*').order('full_name')
    if (role === 'representative' && profile) {
      memberQuery = memberQuery.or(`rep_id.eq.${profile.id},id.eq.${profile.id}`)
    }

    const mealQuery =
      role === 'member'
        ? supabase
            .from('meal_logs')
            .select('member_id, date, quantity, menu_item:menu_items(price), member:profiles(full_name)')
            .eq('member_id', profile?.id)
        : supabase
            .from('meal_logs')
            .select('member_id, date, quantity, menu_item:menu_items(price), member:profiles(full_name)')

    const [{ data: billData }, { data: memberData }, { data: mealData }] = await Promise.all([
      billQuery,
      memberQuery,
      mealQuery,
    ])
    
    let filteredBills = billData || []
    let filteredMeals = mealData || []

    if (role === 'representative') {
      // bill.member.rep_id is not directly selected, so let's filter using the members list
      const memberIds = (memberData || []).map(m => m.id)
      filteredBills = filteredBills.filter(b => memberIds.includes(b.member_id))
      filteredMeals = filteredMeals.filter(m => memberIds.includes(m.member_id))
    }
    
    // Calculate monthly meal bills
    const mealBillsMap: Record<string, any> = {}
    filteredMeals.forEach((log: any) => {
      if (!log.date || !log.menu_item) return;
      
      const month = log.date.substring(0, 7) // "YYYY-MM"
      const memberId = log.member_id
      const key = `${memberId}_${month}`
      
      if (!mealBillsMap[key]) {
        mealBillsMap[key] = {
          id: `meal_bill_${key}`,
          member_id: memberId,
          amount: 0,
          month: month,
          due_date: `${month}-28`, // Display purposes
          is_paid: false,
          is_meal_bill: true,
          member: log.member
        }
      }
      
      const price = log.menu_item.price || 0
      mealBillsMap[key].amount += (log.quantity * price)
    })
    
    const mealBillsArray = Object.values(mealBillsMap)
    const allBills = [...filteredBills, ...mealBillsArray].sort((a, b) => {
      // Sort by month (desc) then by amount (desc)
      if (a.month !== b.month) return b.month.localeCompare(a.month)
      return b.amount - a.amount
    })
    
    setBills(allBills)
    setMembers(memberData || [])
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!form.member_id || !form.amount || !form.due_date) {
      return toast.error('Fill all fields')
    }
    const { error } = await supabase.from('due_bills').insert({
      member_id: form.member_id,
      amount: parseFloat(form.amount),
      month: form.month,
      due_date: form.due_date,
    })
    if (error) return toast.error(error.message)
    toast.success('Bill added!')
    setModalOpen(false)
    setForm({
      member_id: '',
      amount: '',
      month: new Date().toISOString().slice(0, 7),
      due_date: '',
    })
    fetchData()
  }

  const markPaid = async (id: string) => {
    const { error } = await supabase
      .from('due_bills')
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Marked as paid!')
    fetchData()
  }

  const totalPending = bills
    .filter(b => !b.is_paid)
    .reduce((sum, b) => sum + Number(b.amount), 0)
  const totalPaid = bills
    .filter(b => b.is_paid)
    .reduce((sum, b) => sum + Number(b.amount), 0)

  const groupedBills = bills.reduce((acc, bill) => {
    const memberName = bill.member?.full_name || 'Unknown'
    if (!acc[memberName]) acc[memberName] = []
    acc[memberName].push(bill)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="page bills-page">
      <div className="page-header">
        <div>
          <h1>Bills</h1>
          <p className="page-subtitle">
            Pending: ₹{totalPending.toLocaleString()} · Paid: ₹
            {totalPaid.toLocaleString()}
          </p>
        </div>
        {(role === 'admin' || role === 'representative') && (
          <button
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
            id="bills-add-btn"
          >
            <Plus size={18} /> Add Bill
          </button>
        )}
      </div>

      {loading ? (
        <div className="page-loader">
          <div className="loader">
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
          </div>
        </div>
      ) : bills.length === 0 ? (
        <div className="empty-state">
          <CreditCard size={48} />
          <p>No bills yet</p>
        </div>
      ) : (
        <div className="bills-list">
          {role === 'member' ? (
            bills.map(bill => (
              <div
                key={bill.id}
                className={`bill-card ${bill.is_paid ? 'paid' : 'pending'}`}
              >
                <div className="bill-status-icon">
                  {bill.is_meal_bill ? <Utensils size={18} /> : (bill.is_paid ? <Check size={18} /> : <Clock size={18} />)}
                </div>
                <div className="bill-info">
                  <span className="bill-member">
                    {bill.member?.full_name} {bill.is_meal_bill && <span style={{fontSize: '0.8rem', opacity: 0.7}}>(Meal Bill)</span>}
                  </span>
                  <span className="bill-meta">
                    {bill.month} · {bill.is_meal_bill ? 'Updates daily' : `Due: ${new Date(bill.due_date).toLocaleDateString('en-IN')}`}
                    {!bill.is_paid && !bill.is_meal_bill &&
                      new Date(bill.due_date) < new Date() && (
                        <span className="bill-overdue">
                          <AlertCircle size={12} /> Overdue
                        </span>
                      )}
                  </span>
                </div>
                <span className="bill-amount">
                  ₹{Number(bill.amount).toLocaleString()}
                </span>
              </div>
            ))
          ) : (
            Object.entries(groupedBills).map(([memberName, memberBills]) => (
              <div key={memberName} className="card tilt-card" style={{ marginBottom: '16px' }}>
                <h3 style={{ marginBottom: '12px', color: 'var(--primary-light)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  {memberName}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(memberBills as any[]).map((bill: any) => (
                    <div
                      key={bill.id}
                      className={`bill-card ${bill.is_paid ? 'paid' : 'pending'}`}
                      style={{ margin: 0 }}
                    >
                      <div className="bill-status-icon">
                        {bill.is_meal_bill ? <Utensils size={18} /> : (bill.is_paid ? <Check size={18} /> : <Clock size={18} />)}
                      </div>
                      <div className="bill-info">
                        <span className="bill-meta">
                          {bill.month} · {bill.is_meal_bill ? 'Updates daily (Meal Bill)' : `Due: ${new Date(bill.due_date).toLocaleDateString('en-IN')}`}
                          {!bill.is_paid && !bill.is_meal_bill &&
                            new Date(bill.due_date) < new Date() && (
                              <span className="bill-overdue">
                                <AlertCircle size={12} /> Overdue
                              </span>
                            )}
                        </span>
                      </div>
                      <span className="bill-amount">
                        ₹{Number(bill.amount).toLocaleString()}
                      </span>
                      {!bill.is_paid && !bill.is_meal_bill && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => markPaid(bill.id)}
                        >
                          <Check size={14} /> Paid
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Due Bill"
      >
        <div className="modal-form">
          <div className="form-group">
            <label className="form-label">Member</label>
            <select
              className="form-input"
              value={form.member_id}
              onChange={e => setForm({ ...form, member_id: e.target.value })}
            >
              <option value="">Select Member</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input
              type="number"
              className="form-input"
              placeholder="e.g. 2000"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Month</label>
            <input
              type="month"
              className="form-input"
              value={form.month}
              onChange={e => setForm({ ...form, month: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input
              type="date"
              className="form-input"
              value={form.due_date}
              onChange={e => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <button className="btn btn-primary btn-full" onClick={handleAdd}>
            Add Bill
          </button>
        </div>
      </Modal>
    </div>
  )
}
