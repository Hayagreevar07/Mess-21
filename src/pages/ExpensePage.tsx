import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { Plus, Receipt, Trash2, Edit2 } from 'lucide-react'
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
  const { profile } = useAuth()
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'Groceries',
    date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*, added_by_profile:profiles!expenses_added_by_fkey(full_name)')
      .order('date', { ascending: false })
    setExpenses(data || [])
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
      date: new Date().toISOString().split('T')[0],
    })
  }

  const totalExpenses = expenses.reduce(
    (sum, e) => sum + Number(e.amount), 0
  )

  return (
    <div className="page expense-page">
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <p className="page-subtitle">
            Total: ₹{totalExpenses.toLocaleString()}
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
