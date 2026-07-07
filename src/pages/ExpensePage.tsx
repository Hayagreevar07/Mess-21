import { useEffect, useState } from 'react'
import { getLocalDateString, getLocalMonthString } from '../lib/dateUtils'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Plus, Receipt, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const expenseCategories = [
  'Groceries',
  'Gas',
  'Utensils',
  'Maintenance',
  'Transport',
  'Vegetables',
  'Provisions',
  'Water',
  'Electricity',
  'Other',
]

export default function ExpensePage() {
  const { profile, role } = useAuth()
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [memberCount, setMemberCount] = useState(1)
  const [currentMonth, setCurrentMonth] = useState(getLocalMonthString())
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'Groceries',
    date: getLocalDateString(),
  })

  useEffect(() => {
    fetchExpenses()
  }, [currentMonth])

  const fetchExpenses = async () => {
    const startOfMonth = `${currentMonth}-01`
    const [year, month] = currentMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const endOfMonth = `${currentMonth}-${String(lastDay).padStart(2, '0')}`

    let query = supabase
      .from('expenses')
      .select('*, added_by_profile:profiles!expenses_added_by_fkey(full_name, role)')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .order('date', { ascending: false })

    if (role === 'member') {
      query = query.eq('added_by', profile?.id)
    }

    const [{ data }, { count }] = await Promise.all([
      query,
      supabase.from('profiles').select('*', { count: 'exact', head: true })
    ])

    let filteredData = data || []
    
    if (role !== 'member') {
      filteredData = filteredData.filter(e => e.added_by_profile?.role !== 'member')
    }

    setExpenses(filteredData)
    setMemberCount(count || 1)
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.title || !form.amount) return toast.error('Fill all fields')

    const payload = {
      title: form.title,
      amount: parseFloat(form.amount),
      category: form.category,
      date: form.date,
      added_by: profile?.id,
    }

    if (editId) {
      const { error } = await supabase
        .from('expenses')
        .update(payload)
        .eq('id', editId)
      if (error) return toast.error(error.message)
      toast.success('Expense updated!')
    } else {
      const { error } = await supabase.from('expenses').insert(payload)
      if (error) return toast.error(error.message)
      toast.success('Expense added!')
    }

    closeModal()
    fetchExpenses()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Deleted!')
    fetchExpenses()
  }

  const openEdit = (expense: any) => {
    setEditId(expense.id)
    setForm({
      title: expense.title,
      amount: String(expense.amount),
      category: expense.category,
      date: expense.date,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditId(null)
    setForm({
      title: '',
      amount: '',
      category: 'Groceries',
      date: getLocalDateString(),
    })
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const perMemberShare = totalExpenses / memberCount

  const changeMonth = (delta: number) => {
    const [year, month] = currentMonth.split('-').map(Number)
    const newDate = new Date(year, month - 1 + delta, 1)
    setCurrentMonth(getLocalMonthString(newDate))
  }

  return (
    <div className="page expense-page">
      <div className="page-header">
        <div>
          <h1>{role === 'member' ? 'My Expenses' : 'Expenses'}</h1>
          <p className="page-subtitle">
            Total: ₹{totalExpenses.toLocaleString()}
            {role !== 'member' && ` · Share: ₹${perMemberShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}/member`}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { closeModal(); setModalOpen(true) }}
          id="expense-add-btn"
        >
          <Plus size={18} /> Add Expense
        </button>
      </div>
      
      <div className="meal-controls" style={{ marginBottom: '20px' }}>
        <div className="date-navigator" style={{ margin: '0 auto' }}>
          <button className="btn-icon" onClick={() => changeMonth(-1)}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontWeight: 'bold', minWidth: '100px', textAlign: 'center' }}>
            {new Date(`${currentMonth}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </span>
          <button className="btn-icon" onClick={() => changeMonth(1)}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="page-loader">
          <div className="loader">
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
          </div>
        </div>
      ) : expenses.length === 0 ? (
        <div className="empty-state">
          <Receipt size={48} />
          <p>No expenses recorded yet</p>
        </div>
      ) : (
        <div className="expense-list">
          {expenses.map(exp => (
            <div key={exp.id} className="expense-card">
              <div className="expense-icon">
                <Receipt size={18} />
              </div>
              <div className="expense-info">
                <span className="expense-title">{exp.title}</span>
                <span className="expense-meta">
                  {exp.category} ·{' '}
                  {new Date(exp.date).toLocaleDateString('en-IN')} · by{' '}
                  {exp.added_by_profile?.full_name}
                </span>
              </div>
              <span className="expense-amount">
                ₹{Number(exp.amount).toLocaleString()}
              </span>
              {exp.added_by === profile?.id && (
                <div className="expense-actions">
                  <button className="btn-icon" onClick={() => openEdit(exp)}>
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(exp.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editId ? 'Edit Expense' : 'Add Expense'}
      >
        <div className="modal-form">
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Monthly groceries"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input
              type="number"
              className="form-input"
              placeholder="e.g. 500"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
            >
              {expenseCategories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <button className="btn btn-primary btn-full" onClick={handleSave}>
            {editId ? 'Update Expense' : 'Add Expense'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
