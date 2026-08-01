import { useEffect, useState } from 'react'
import { getLocalDateString, getLocalMonthString } from '../lib/dateUtils'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { CreditCard, Plus, Check, Clock, Utensils, Receipt, ChevronLeft, ChevronRight, CheckCircle2, DollarSign, Bell, Calendar, Printer, Filter, ChevronDown, ChevronUp, User, Download } from 'lucide-react'
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

  const [detailedModalOpen, setDetailedModalOpen] = useState(false)
  const [detailedLoading, setDetailedLoading] = useState(false)
  const [detailedLogs, setDetailedLogs] = useState<any[]>([])
  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [snapshotDetailedData, setSnapshotDetailedData] = useState<any[]>([])
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})

  const handleOpenDetailedModal = () => {
    setDetailedModalOpen(true)
    fetchDetailedLogs()
  }

  const fetchDetailedLogs = async () => {
    setDetailedLoading(true)
    const startOfMonth = `${selectedMonth}-01`
    const [year, month] = selectedMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const endOfMonth = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`

    let query = supabase
      .from('meal_logs')
      .select(`
        id,
        date,
        meal_type,
        quantity,
        member_id,
        profiles:member_id(id, full_name, avatar_url),
        menu_item:menu_items(id, name, price, category)
      `)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .order('date', { ascending: true })

    let snapQuery = supabase
      .from('monthly_bills')
      .select(`
        id,
        month,
        total_meal_amount,
        expense_share,
        meal_details,
        member_id,
        profile:member_id(id, full_name, avatar_url)
      `)
      .eq('month', selectedMonth)

    if (role === 'representative' && profile) {
      const { data: memberData } = await supabase
        .from('profiles')
        .select('id')
        .or(`rep_id.eq.${profile.id},id.eq.${profile.id}`)
      const mIds = (memberData || []).map(m => m.id)
      if (mIds.length > 0) {
        query = query.in('member_id', mIds)
        snapQuery = snapQuery.in('member_id', mIds)
      }
    } else if (role === 'member' && profile) {
      query = query.eq('member_id', profile.id)
      snapQuery = snapQuery.eq('member_id', profile.id)
    }

    const [{ data: logsData, error }, { data: snapData }] = await Promise.all([
      query,
      snapQuery
    ])

    if (error) {
      console.error('Failed to load detailed logs:', error)
      toast.error('Failed to load detailed daily logs')
    } else {
      setDetailedLogs(logsData || [])
    }
    setSnapshotDetailedData(snapData || [])
    setDetailedLoading(false)
  }

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

    // 3. Check for snapshot
    const currentMonthStr = getLocalMonthString(new Date())
    const isPastMonth = selectedMonth < currentMonthStr
    let snapshotData = null

    if (isPastMonth) {
      let snapshotQuery = supabase.from('monthly_bills').select('*').eq('month', selectedMonth)
      if (role !== 'admin') snapshotQuery = snapshotQuery.in('member_id', memberIds)
      const { data: snap } = await snapshotQuery
      if (snap && snap.length > 0) snapshotData = snap
    }

    let mealData: any = []
    let expenseShare = 0

    if (!snapshotData) {
      // Fetch dynamically
      let mealQuery = supabase
        .from('meal_logs')
        .select('member_id, date, quantity, menu_item:menu_items(name, price)')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)

      if (role !== 'admin') mealQuery = mealQuery.in('member_id', memberIds)
      const { data: mData } = await mealQuery
      mealData = mData

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
        
      expenseShare = totalActiveMembers ? totalMessExpenses / totalActiveMembers : 0
    }

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

    // Add meals or snapshot data
    if (snapshotData) {
      snapshotData.forEach((snap: any) => {
        const s = settlementMap[snap.member_id]
        if (s) {
          s.mealTotal = Number(snap.total_meal_amount) || 0
          s.expenseShare = Number(snap.expense_share) || 0
          s.mealBreakdown = snap.meal_details || {}
        }
      })
    } else {
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
    }

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

  // Aggregate detailed logs for detailed daily modal view
  const dateMap: Record<string, {
    date: string
    dayLabel: string
    members: Record<string, {
      profile: any
      meals: Record<string, Array<{ name: string; price: number; qty: number; total: number }>>
      memberTotal: number
    }>
    dateTotal: number
  }> = {}

  detailedLogs.forEach((log: any) => {
    const d = log.date
    const mId = log.member_id
    if (memberFilter !== 'all' && mId !== memberFilter) return

    const menuItem = Array.isArray(log.menu_item) ? log.menu_item[0] : log.menu_item
    if (!menuItem) return

    const price = Number(menuItem.price) || 0
    const qty = Number(log.quantity) || 1
    const cost = price * qty
    const mealType = log.meal_type || 'other'
    const profileObj = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles || { full_name: 'Member', id: mId }

    if (!dateMap[d]) {
      const dateParts = d.split('-').map(Number)
      const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
      const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
      dateMap[d] = {
        date: d,
        dayLabel,
        members: {},
        dateTotal: 0
      }
    }

    if (!dateMap[d].members[mId]) {
      dateMap[d].members[mId] = {
        profile: profileObj,
        meals: {},
        memberTotal: 0
      }
    }

    const memberEntry = dateMap[d].members[mId]
    if (!memberEntry.meals[mealType]) {
      memberEntry.meals[mealType] = []
    }

    const existing = memberEntry.meals[mealType].find((i: any) => i.name === menuItem.name)
    if (existing) {
      existing.qty += qty
      existing.total += cost
    } else {
      memberEntry.meals[mealType].push({
        name: menuItem.name,
        price,
        qty,
        total: cost
      })
    }

    memberEntry.memberTotal += cost
    dateMap[d].dateTotal += cost
  })

  // Fallback: Populate dateMap from snapshot JSON array if meal_logs was cleared
  if (Object.keys(dateMap).length === 0 && snapshotDetailedData.length > 0) {
    snapshotDetailedData.forEach((snap: any) => {
      const mId = snap.member_id
      if (memberFilter !== 'all' && mId !== memberFilter) return
      const profileObj = snap.profile || { full_name: 'Member', id: mId }
      const details = snap.meal_details

      if (Array.isArray(details)) {
        details.forEach((entry: any) => {
          const d = entry.date || `${selectedMonth}-01`
          const mealType = entry.meal_type || 'other'
          const itemName = entry.item_name || 'Item'
          const price = Number(entry.unit_price) || 0
          const qty = Number(entry.qty) || 1
          const cost = Number(entry.total) || price * qty

          if (!dateMap[d]) {
            const dateParts = d.split('-').map(Number)
            const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
            const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
            dateMap[d] = {
              date: d,
              dayLabel,
              members: {},
              dateTotal: 0
            }
          }

          if (!dateMap[d].members[mId]) {
            dateMap[d].members[mId] = {
              profile: profileObj,
              meals: {},
              memberTotal: 0
            }
          }

          const memberEntry = dateMap[d].members[mId]
          if (!memberEntry.meals[mealType]) {
            memberEntry.meals[mealType] = []
          }

          memberEntry.meals[mealType].push({
            name: itemName,
            price,
            qty,
            total: cost
          })

          memberEntry.memberTotal += cost
          dateMap[d].dateTotal += cost
        })
      }
    })
  }

  const sortedDates = Object.keys(dateMap).sort()
  const monthGrandTotal = sortedDates.reduce((sum: number, d: string) => sum + dateMap[d].dateTotal, 0)

  const filteredSnapshots = snapshotDetailedData.filter((snap: any) => {
    if (memberFilter === 'all') return true
    return snap.member_id === memberFilter
  })

  const snapshotGrandTotal = filteredSnapshots.reduce((sum: number, snap: any) => sum + Number(snap.total_meal_amount || 0) + Number(snap.expense_share || 0), 0)

  const exportToCSV = () => {
    let csvRows: string[][] = []

    if (sortedDates.length > 0) {
      csvRows.push(['Date', 'Day', 'Member Name', 'Meal Type', 'Item Name', 'Unit Price (INR)', 'Quantity', 'Line Total (INR)', 'Member Day Subtotal (INR)'])

      sortedDates.forEach((dateKey: string) => {
        const dayData = dateMap[dateKey]
        const memberIds = Object.keys(dayData.members)

        memberIds.forEach((mId: string) => {
          const mEntry = dayData.members[mId]
          if (memberFilter !== 'all' && mId !== memberFilter) return
          const mealTypes = Object.keys(mEntry.meals)

          mealTypes.forEach((mType: string) => {
            mEntry.meals[mType].forEach((item: any) => {
              csvRows.push([
                dateKey,
                `"${dayData.dayLabel.replace(/"/g, '""')}"`,
                `"${(mEntry.profile?.full_name || 'Member').replace(/"/g, '""')}"`,
                mType.toUpperCase(),
                `"${item.name.replace(/"/g, '""')}"`,
                item.price.toString(),
                item.qty.toString(),
                item.total.toString(),
                mEntry.memberTotal.toString()
              ])
            })
          })
        })
      })
    } else if (filteredSnapshots.length > 0) {
      csvRows.push(['Month', 'Member Name', 'Item Name', 'Quantity', 'Line Total (INR)', 'Expense Share (INR)', 'Member Month Total (INR)'])

      filteredSnapshots.forEach((snap: any) => {
        const memberName = snap.profile?.full_name || 'Member'
        const items = Object.entries(snap.meal_details || {})

        if (items.length === 0) {
          csvRows.push([
            selectedMonth,
            `"${memberName.replace(/"/g, '""')}"`,
            'No Meals Logged',
            '0',
            '0',
            snap.expense_share.toString(),
            snap.expense_share.toString()
          ])
        } else {
          items.forEach(([itemName, data]: [string, any]) => {
            const qty = data.qty || 0
            const total = data.total || 0
            csvRows.push([
              selectedMonth,
              `"${memberName.replace(/"/g, '""')}"`,
              `"${itemName.replace(/"/g, '""')}"`,
              qty.toString(),
              total.toString(),
              snap.expense_share.toString(),
              (Number(snap.total_meal_amount) + Number(snap.expense_share)).toString()
            ])
          })
        }
      })
    }

    if (csvRows.length <= 1) {
      toast.error('No data available to export for this month')
      return
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${selectedMonth}_Detailed_Mess_Bill.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${selectedMonth} Detailed Bill as CSV! 📄`)
  }

  return (
    <div className="page bills-page">
      <div className="page-header">
        <div>
          <h1>Settlements</h1>
          <p className="page-subtitle">Unified view of meals, expenses, and bills</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleOpenDetailedModal}>
            <Calendar size={18} /> Detailed Daily Bill
          </button>
          {(role === 'admin' || role === 'representative') && (
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={18} /> Manual Bill
            </button>
          )}
        </div>
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

      {/* Detailed Daily Bill Modal */}
      <Modal 
        isOpen={detailedModalOpen} 
        onClose={() => setDetailedModalOpen(false)} 
        title={`Detailed Daily Bill - ${new Date(`${selectedMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`}
      >
        <div className="detailed-bill-container" style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
          {/* Controls Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} style={{ color: 'var(--text-muted)' }} />
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Filter Member:</label>
              <select 
                className="form-input" 
                style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', background: 'var(--bg-dark)', color: 'var(--text-light)' }}
                value={memberFilter} 
                onChange={e => setMemberFilter(e.target.value)}
              >
                <option value="all">All Members ({members.length})</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {sortedDates.length > 0 && (
                <button 
                  className="btn btn-sm btn-outline" 
                  onClick={() => {
                    const allExpanded = sortedDates.every(d => expandedDates[d] !== false)
                    const next: Record<string, boolean> = {}
                    sortedDates.forEach(d => { next[d] = !allExpanded })
                    setExpandedDates(next)
                  }}
                >
                  {sortedDates.every(d => expandedDates[d] !== false) ? 'Collapse All' : 'Expand All'}
                </button>
              )}
              <button 
                className="btn btn-sm btn-secondary" 
                onClick={exportToCSV}
              >
                <Download size={14} /> Export CSV
              </button>
              <button 
                className="btn btn-sm btn-primary" 
                onClick={() => window.print()}
              >
                <Printer size={14} /> Print Statement
              </button>
            </div>
          </div>

          {/* Stats Summary Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sortedDates.length > 0 ? 'Active Days' : 'Snapshot Month'}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-light)' }}>{sortedDates.length > 0 ? `${sortedDates.length} Days` : selectedMonth}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Records Found</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-light)' }}>{sortedDates.length > 0 ? `${detailedLogs.length} Entries` : `${filteredSnapshots.length} Members`}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Bill Amount</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                ₹{(sortedDates.length > 0 ? monthGrandTotal : snapshotGrandTotal).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Daily Records or Snapshot Records */}
          {detailedLoading ? (
            <div className="page-loader" style={{ padding: '40px' }}>
              <div className="loader"><div className="loader-ring"></div><div className="loader-ring"></div></div>
            </div>
          ) : sortedDates.length === 0 && filteredSnapshots.length > 0 ? (
            /* Snapshot Monthly Breakdown View for past archived months */
            <div id="detailed-bill-print-area" style={{ display: 'grid', gap: '14px' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '12px 16px', fontSize: '0.85rem', color: 'var(--warning)' }}>
                ℹ️ Past month daily logs were archived into the monthly bill snapshot. Showing itemized monthly consumption breakdown below.
              </div>
              {filteredSnapshots.map((snap: any) => {
                const memberName = snap.profile?.full_name || 'Member'
                const items = Object.entries(snap.meal_details || {}) as [string, { qty: number; total: number }][]
                const totalMealAmt = Number(snap.total_meal_amount || 0)
                const expShare = Number(snap.expense_share || 0)

                return (
                  <div key={snap.id} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={16} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-light)' }}>{memberName}</span>
                      </div>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary-light)' }}>
                        ₹{(totalMealAmt + expShare).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: '6px', fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem' }}>ITEMIZED MEAL CONSUMPTION</div>
                      {items.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No meals logged</div>
                      ) : (
                        items.map(([itemName, data]) => (
                          <div key={itemName} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                            <span>• {itemName} × {data.qty}</span>
                            <span style={{ fontWeight: 600 }}>₹{data.total}</span>
                          </div>
                        ))
                      )}

                      {expShare > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                          <span>Shared Mess Expense Share</span>
                          <span style={{ fontWeight: 600 }}>₹{expShare}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : sortedDates.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px' }}>
              <Utensils size={36} />
              <p>No detailed meal records logged for {new Date(`${selectedMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
            </div>
          ) : (
            <div id="detailed-bill-print-area" style={{ display: 'grid', gap: '14px' }}>
              {sortedDates.map(dateKey => {
                const dayData = dateMap[dateKey]
                const isExpanded = expandedDates[dateKey] !== false
                const memberIds = Object.keys(dayData.members)

                return (
                  <div key={dateKey} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                    
                    {/* Date Header */}
                    <div 
                      onClick={() => setExpandedDates((prev: Record<string, boolean>) => ({ ...prev, [dateKey]: !isExpanded }))}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px 16px', 
                        background: 'rgba(255,255,255,0.04)', 
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ background: 'var(--primary)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {dayData.date}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-light)', fontSize: '0.95rem' }}>
                          {dayData.dayLabel}
                        </span>
                        <span className="badge" style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                          {memberIds.length} {memberIds.length === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--primary-light)', fontSize: '1rem' }}>
                          ₹{dayData.dateTotal.toLocaleString('en-IN')}
                        </span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* Date Body */}
                    {isExpanded && (
                      <div style={{ padding: '14px 16px', display: 'grid', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        {memberIds.map(mId => {
                          const mEntry = dayData.members[mId]
                          const mealTypes = Object.keys(mEntry.meals)
                          
                          const mealEmoji: Record<string, string> = {
                            breakfast: '🌅 Breakfast',
                            lunch: '☀️ Lunch',
                            dinner: '🌙 Dinner',
                            snack: '🍿 Snack'
                          }

                          return (
                            <div key={mId} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px' }}>
                              
                              {/* Member Row Header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <User size={14} style={{ color: 'var(--primary)' }} />
                                  <span style={{ fontWeight: 700, color: 'var(--text-light)', fontSize: '0.9rem' }}>
                                    {mEntry.profile.full_name}
                                  </span>
                                </div>
                                <span style={{ fontWeight: 'bold', color: 'var(--warning)', fontSize: '0.9rem' }}>
                                  Day Total: ₹{mEntry.memberTotal.toLocaleString('en-IN')}
                                </span>
                              </div>

                              {/* Meal Categories */}
                              <div style={{ display: 'grid', gap: '8px' }}>
                                {mealTypes.map(mType => (
                                  <div key={mType} style={{ fontSize: '0.85rem' }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '2px', textTransform: 'capitalize' }}>
                                      {mealEmoji[mType] || mType}
                                    </div>
                                    <div style={{ paddingLeft: '8px', display: 'grid', gap: '2px' }}>
                                      {mEntry.meals[mType].map((item: any, idx: number) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                          <span>
                                            • {item.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(₹{item.price} × {item.qty})</span>
                                          </span>
                                          <span style={{ fontWeight: 600 }}>₹{item.total}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>

                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
