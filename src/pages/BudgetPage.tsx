import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { PiggyBank, TrendingUp, TrendingDown, Target, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BudgetPage() {
  const { profile } = useAuth()
  const [budget, setBudget] = useState(5000)
  const [tempBudget, setTempBudget] = useState('5000')
  const [spent, setSpent] = useState(0)
  const [mealBreakdown, setMealBreakdown] = useState<
    { name: string; total: number }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    // Load budget from localStorage
    const saved = localStorage.getItem(`budget_${profile.id}`)
    if (saved) {
      setBudget(Number(saved))
      setTempBudget(saved)
    }
    fetchSpending()
  }, [profile])

  const fetchSpending = async () => {
    if (!profile) return
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    )
      .toISOString()
      .split('T')[0]

    const { data: mealData } = await supabase
      .from('meal_logs')
      .select('quantity, menu_item:menu_items(name, price)')
      .eq('member_id', profile.id)
      .gte('date', monthStart)

    const currentMonthStr = new Date().toISOString().slice(0, 7) // YYYY-MM
    const { data: billsData } = await supabase
      .from('due_bills')
      .select('amount')
      .eq('member_id', profile.id)
      .eq('month', currentMonthStr)

    let totalSpent = 0
    const breakdown: Record<string, number> = {}

    if (mealData) {
      mealData.forEach(m => {
        const name = (m.menu_item as any)?.name || 'Unknown'
        const amount = (Number((m.menu_item as any)?.price) || 0) * m.quantity
        totalSpent += amount
        breakdown[name] = (breakdown[name] || 0) + amount
      })
    }

    if (billsData) {
      billsData.forEach(b => {
        const amount = Number(b.amount) || 0
        totalSpent += amount
        breakdown['Manual Bills'] = (breakdown['Manual Bills'] || 0) + amount
      })
    }

    setSpent(totalSpent)
    setMealBreakdown(
      Object.entries(breakdown)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
    )
    setLoading(false)
  }

  const saveBudget = () => {
    const val = Number(tempBudget)
    if (isNaN(val) || val <= 0) return toast.error('Enter a valid amount')
    setBudget(val)
    localStorage.setItem(`budget_${profile?.id}`, String(val))
    toast.success('Budget saved!')
  }

  const remaining = budget - spent
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const isOverBudget = spent > budget

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
    <div className="page budget-page">
      <div className="page-header">
        <div>
          <h1>Budget</h1>
          <p className="page-subtitle">Track your monthly spending</p>
        </div>
      </div>

      <div className="budget-set-card glass-card">
        <div className="budget-set-header">
          <Target size={20} />
          <span>Set Monthly Budget</span>
        </div>
        <div className="budget-set-input">
          <span className="currency-prefix">₹</span>
          <input
            type="number"
            className="form-input budget-input"
            value={tempBudget}
            onChange={e => setTempBudget(e.target.value)}
            id="budget-input"
          />
          <button className="btn btn-primary" onClick={saveBudget}>
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      <div className="budget-overview glass-card">
        <div className="budget-circle-container">
          <svg className="budget-circle" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" className="budget-circle-bg" />
            <circle
              cx="60"
              cy="60"
              r="52"
              className="budget-circle-progress"
              style={{
                strokeDasharray: `${2 * Math.PI * 52}`,
                strokeDashoffset: `${2 * Math.PI * 52 * (1 - percentage / 100)}`,
                stroke: isOverBudget
                  ? 'var(--danger)'
                  : percentage > 75
                    ? 'var(--warning)'
                    : 'var(--primary)',
              }}
            />
          </svg>
          <div className="budget-circle-text">
            <span className="budget-percentage">
              {Math.round(percentage)}%
            </span>
            <span className="budget-label">used</span>
          </div>
        </div>

        <div className="budget-stats">
          <div className="budget-stat">
            <PiggyBank size={18} />
            <div>
              <span className="budget-stat-label">Budget</span>
              <span className="budget-stat-value">
                ₹{budget.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="budget-stat">
            <TrendingUp size={18} />
            <div>
              <span className="budget-stat-label">Spent</span>
              <span className="budget-stat-value spent">
                ₹{spent.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="budget-stat">
            {isOverBudget ? (
              <TrendingDown size={18} />
            ) : (
              <Target size={18} />
            )}
            <div>
              <span className="budget-stat-label">
                {isOverBudget ? 'Over Budget' : 'Remaining'}
              </span>
              <span
                className={`budget-stat-value ${isOverBudget ? 'over' : 'remaining'}`}
              >
                ₹{Math.abs(remaining).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {mealBreakdown.length > 0 && (
        <div className="budget-breakdown glass-card">
          <h3>Spending Breakdown</h3>
          <div className="breakdown-list">
            {mealBreakdown.map(item => (
              <div key={item.name} className="breakdown-item">
                <span className="breakdown-name">{item.name}</span>
                <div className="breakdown-bar-container">
                  <div
                    className="breakdown-bar"
                    style={{
                      width: `${spent > 0 ? (item.total / spent) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
                <span className="breakdown-amount">₹{item.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
