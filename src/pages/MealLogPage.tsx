import React, { useEffect, useState, useCallback } from 'react'
import { getLocalDateString } from '../lib/dateUtils'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { MenuItem, MealType, Profile } from '../lib/types'
import { Plus, Minus, Save, ChevronLeft, ChevronRight, ShoppingCart, Calendar as CalendarIcon, LayoutList } from 'lucide-react'
import toast from 'react-hot-toast'

const mealTypes: { value: MealType; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch', label: 'Lunch', emoji: '☀️' },
  { value: 'dinner', label: 'Dinner', emoji: '🌙' },
  { value: 'snack', label: 'Snack', emoji: '🍿' },
]

// Food emoji mapping
const FOOD_EMOJI_MAP: Record<string, string> = {
  idli: '🫓', dosa: '🥞', masala: '🥞', vada: '🧆', poori: '🫓',
  upma: '🍚', pongal: '🍲', uttapam: '🫓', rava: '🥞',
  chapati: '🫓', rice: '🍚', sambar: '🍲', curd: '🥛', lemon: '🍋',
  tomato: '🍅', biryani: '🍛', chicken: '🍗', egg: '🥚',
  parotta: '🫓', fried: '🍳', noodles: '🍜', roti: '🫓',
  tea: '🍵', coffee: '☕', biscuit: '🍪', juice: '🧃',
  banana: '🍌', samosa: '🥟', bajji: '🍤', bonda: '🧆',
}

function getFoodEmoji(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, emoji] of Object.entries(FOOD_EMOJI_MAP)) {
    if (lower.includes(key)) return emoji
  }
  return '🍽️'
}

const MenuItemCard = React.memo(({ item, qty, onUpdate }: { item: MenuItem, qty: number, onUpdate: (id: string, delta: number) => void }) => {
  return (
    <div className={`menu-item-card ${qty > 0 ? 'selected' : ''}`}>
      <span className="menu-item-emoji">{getFoodEmoji(item.name)}</span>
      <div className="menu-item-info">
        <span className="menu-item-name">{item.name}</span>
        <span className="menu-item-price">₹{item.price}</span>
      </div>
      <div className="menu-item-actions">
        {qty > 0 && (
          <button className="btn-icon" onClick={() => onUpdate(item.id, -1)}>
            <Minus size={16} />
          </button>
        )}
        <span className="menu-item-qty">{qty}</span>
        <button className="btn-icon btn-primary" onClick={() => onUpdate(item.id, 1)}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
})

export default function MealLogPage() {
  const { profile, role } = useAuth()
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [selectedMember, setSelectedMember] = useState<string>('')
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast')
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [cart, setCart] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'day' | 'calendar'>('day')
  const [monthlyLogs, setMonthlyLogs] = useState<any[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedMember && selectedDate && selectedMealType && viewMode === 'day') {
      fetchExistingLogs()
    }
  }, [selectedMember, selectedDate, selectedMealType, viewMode])

  useEffect(() => {
    if (viewMode === 'calendar') {
      fetchMonthlyLogs()
    }
  }, [selectedMember, selectedDate, viewMode])

  // Auto-select meal type based on time of day
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 11) setSelectedMealType('breakfast')
    else if (hour >= 11 && hour < 15) setSelectedMealType('lunch')
    else if (hour >= 15 && hour < 18) setSelectedMealType('snack')
    else setSelectedMealType('dinner')
  }, [])

  const fetchData = async () => {
    // Fetch menu items
    const { data: items } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('category')
      .order('name')

    // For reps, only fetch their own members and themselves; for admin, fetch all
    let profilesQuery = supabase.from('profiles').select('*').order('full_name')
    if (role === 'representative' && profile) {
      profilesQuery = profilesQuery.or(`rep_id.eq.${profile.id},id.eq.${profile.id}`)
    }
    const { data: profiles } = await profilesQuery

    setMenuItems((items as MenuItem[]) || [])
    setMembers((profiles as Profile[]) || [])
    if (role === 'member' && profile) {
      setSelectedMember(profile.id)
    }
    setLoading(false)
  }

  const fetchExistingLogs = async () => {
    const { data } = await supabase
      .from('meal_logs')
      .select('*, menu_item:menu_items(name, price)')
      .eq('member_id', selectedMember)
      .eq('date', selectedDate)
      .eq('meal_type', selectedMealType)

    const cartFromLogs: Record<string, number> = {}
    data?.forEach(log => {
      cartFromLogs[log.menu_item_id] = log.quantity
    })
    setCart(cartFromLogs)
  }

  const fetchMonthlyLogs = async () => {
    if (!selectedMember || !selectedDate) return
    const [year, month] = selectedDate.split('-')
    const startOfMonth = `${year}-${month}-01`
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

    const { data } = await supabase
      .from('meal_logs')
      .select('*, menu_item:menu_items(name, price)')
      .eq('member_id', selectedMember)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    setMonthlyLogs(data || [])
  }

  const saveCartToDb = async (cartState: Record<string, number>, member: string, date: string, type: MealType) => {
    setSaving(true)
    try {
      await supabase
        .from('meal_logs')
        .delete()
        .eq('member_id', member)
        .eq('date', date)
        .eq('meal_type', type)

      const entries = Object.entries(cartState).filter(([_, qty]) => qty > 0)
      if (entries.length > 0) {
        const { error } = await supabase.from('meal_logs').insert(
          entries.map(([itemId, qty]) => ({
            member_id: member,
            menu_item_id: itemId,
            meal_type: type,
            date: date,
            quantity: qty,
            logged_by: profile?.id,
          }))
        )
        if (error) throw error
      }

      toast.success('Meals updated! 🎉')
      fetchExistingLogs()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const updateCart = useCallback((itemId: string, delta: number) => {
    setCart(prev => {
      const newQty = Math.max(0, (prev[itemId] || 0) + delta)
      const newCart = { ...prev }
      if (newQty === 0) {
        delete newCart[itemId]
      } else {
        newCart[itemId] = newQty
      }
      
      if (delta < 0 && selectedMember) {
        // Auto-save on minus
        saveCartToDb(newCart, selectedMember, selectedDate, selectedMealType)
      }
      
      return newCart
    })
  }, [selectedMember, selectedDate, selectedMealType, profile])

  const handleSave = () => {
    if (!selectedMember) return toast.error('Select a member')
    saveCartToDb(cart, selectedMember, selectedDate, selectedMealType)
  }

  const changeDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(getLocalDateString(d))
  }

  const isToday = selectedDate === getLocalDateString()

  const filteredItems = menuItems.filter(
    item => item.category === selectedMealType || item.category === 'snack'
  )

  const totalAmount = Object.entries(cart).reduce((sum, [itemId, qty]) => {
    const item = menuItems.find(i => i.id === itemId)
    return sum + (item ? Number(item.price) * qty : 0)
  }, 0)

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0)

  if (loading) {
    return (
      <div className="page meal-log-page">
        <div className="skeleton" style={{ height: '32px', width: '200px', marginBottom: '16px' }}></div>
        <div className="skeleton" style={{ height: '48px', marginBottom: '12px' }}></div>
        <div className="skeleton" style={{ height: '48px', marginBottom: '24px' }}></div>
        <div className="menu-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton" style={{ height: '88px', borderRadius: '12px' }}></div>
          ))}
        </div>
      </div>
    )
  }

  const renderCalendar = () => {
    const [year, month] = selectedDate.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    
    const days = []
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      const dayLogs = monthlyLogs.filter(log => log.date === dateStr)
      
      const emojis = dayLogs.map(log => getFoodEmoji(log.menu_item?.name || ''))
      // Remove duplicates
      const uniqueEmojis = [...new Set(emojis)].slice(0, 4)
      const hasMore = emojis.length > 4
      
      days.push(
        <div key={i} className={`calendar-day ${dateStr === getLocalDateString() ? 'today' : ''} ${dayLogs.length > 0 ? 'has-logs' : ''}`} onClick={() => {
          setSelectedDate(dateStr)
          setViewMode('day')
        }}>
          <span className="calendar-date-num">{i}</span>
          <div className="calendar-emojis">
            {uniqueEmojis.map((emoji, idx) => <span key={idx} style={{ fontSize: '1.2rem' }}>{emoji}</span>)}
            {hasMore && <span className="calendar-more" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>+{emojis.length - 4}</span>}
          </div>
        </div>
      )
    }

    return (
      <div className="calendar-view card glass-card" style={{ padding: '16px', marginTop: '16px' }}>
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="calendar-header-day">{d}</div>
          ))}
          {days}
        </div>
      </div>
    )
  }

  return (
    <div className="page meal-log-page">
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1>Log Meals</h1>
          <p className="page-subtitle">
            {viewMode === 'day' 
              ? (isToday ? "📍 Today's meals" : `📅 ${new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`)
              : `📅 ${new Date(selectedDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn-icon ${viewMode === 'day' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('day')}
            title="Day View"
          >
            <LayoutList size={20} />
          </button>
          <button 
            className={`btn-icon ${viewMode === 'calendar' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('calendar')}
            title="Calendar View"
          >
            <CalendarIcon size={20} />
          </button>
        </div>
      </div>

      <div className="meal-controls">
        <div className="date-navigator">
          <button className="btn-icon" onClick={() => changeDate(-1)}>
            <ChevronLeft size={20} />
          </button>
          <input
            type="date"
            className="form-input date-input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          <button className="btn-icon" onClick={() => changeDate(1)}>
            <ChevronRight size={20} />
          </button>
          {!isToday && (
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setSelectedDate(getLocalDateString())}
            >
              Today
            </button>
          )}
        </div>

        {(role === 'admin' || role === 'representative') && (
          <div className="form-group">
            <select
              className="form-input"
              value={selectedMember}
              onChange={e => setSelectedMember(e.target.value)}
              id="meal-member-select"
            >
              <option value="">👤 Select Member</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {viewMode === 'day' && (
          <div className="meal-type-tabs">
            {mealTypes.map(mt => (
              <button
                key={mt.value}
                className={`meal-tab ${selectedMealType === mt.value ? 'active' : ''}`}
                onClick={() => setSelectedMealType(mt.value)}
              >
                {mt.emoji} {mt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'calendar' ? (
        renderCalendar()
      ) : (
        <>
          <div className="menu-grid meal-grid">
            {filteredItems.map(item => (
              <MenuItemCard 
                key={item.id} 
                item={item} 
                qty={cart[item.id] || 0} 
                onUpdate={updateCart} 
              />
            ))}
          </div>

          {totalItems > 0 && (
            <div className="meal-summary-bar">
              <div className="meal-summary-info">
                <ShoppingCart size={18} />
                <span className="meal-summary-count">
                  {totalItems} item{totalItems !== 1 ? 's' : ''}
                </span>
                <span className="meal-summary-total text-gradient" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                  ₹{totalAmount}
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                id="meal-save-btn"
              >
                <Save size={18} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
