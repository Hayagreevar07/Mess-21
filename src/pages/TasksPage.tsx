import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Task, Profile } from '../lib/types'
import { CheckSquare, Plus, Circle, CheckCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'

export default function TasksPage() {
  const { role, profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    assigned_to: '',
    due_date: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const isPrivileged = role === 'admin' || role === 'representative'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      let tasksQuery = supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, rep_id)')
        .order('status', { ascending: true }) // todo -> in_progress -> done
        .order('due_date', { ascending: true })
      
      let membersQuery = supabase.from('profiles').select('*').order('full_name')
      
      if (role === 'representative') {
        // Representative only assigns tasks to their members
        membersQuery = membersQuery.eq('rep_id', profile?.id)
      }

      const [tasksRes, membersRes] = await Promise.all([
        tasksQuery,
        membersQuery
      ])

      if (tasksRes.error) throw tasksRes.error
      if (membersRes.error) throw membersRes.error

      let filteredTasks = tasksRes.data as Task[]
      if (role === 'representative') {
        filteredTasks = filteredTasks.filter(t => !t.assigned_to || (t as any).assignee?.rep_id === profile?.id)
      }

      setTasks(filteredTasks)
      setMembers(membersRes.data as Profile[])
    } catch (err) {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return toast.error('Title is required')

    setSubmitting(true)
    try {
      const { error } = await supabase.from('tasks').insert({
        title: form.title.trim(),
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
        status: 'todo'
      })

      if (error) throw error
      toast.success('Task created')
      setIsModalOpen(false)
      setForm({ title: '', assigned_to: '', due_date: '' })
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = async (task: Task) => {
    if (!isPrivileged) return
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id)
      
      if (error) throw error
      toast.success(newStatus === 'done' ? 'Task completed! 🎉' : 'Task reopened')
      fetchData()
    } catch (err) {
      toast.error('Failed to update task')
    }
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Mess Tasks</h1>
          <p className="page-subtitle">Track to-dos and chores for the mess</p>
        </div>
        {isPrivileged && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Add Task
          </button>
        )}
      </header>

      {loading ? (
        <div className="skeleton" style={{ height: '300px', borderRadius: '16px' }}></div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <CheckSquare size={48} className="empty-icon" />
          <h3>No tasks</h3>
          <p>Everything is caught up!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {tasks.map(task => {
            const isDone = task.status === 'done'
            const isOverdue = !isDone && task.due_date && new Date(task.due_date) < new Date()

            return (
              <div 
                key={task.id} 
                className="card tilt-card" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '16px',
                  opacity: isDone ? 0.6 : 1,
                  padding: '16px'
                }}
              >
                <button 
                  onClick={() => toggleStatus(task)} 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: isPrivileged ? 'pointer' : 'default',
                    color: isDone ? 'var(--success)' : 'var(--text-muted)'
                  }}
                  disabled={!isPrivileged}
                >
                  {isDone ? <CheckCircle size={24} /> : <Circle size={24} />}
                </button>
                
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: '500', 
                    color: 'var(--text-primary)',
                    textDecoration: isDone ? 'line-through' : 'none'
                  }}>
                    {task.title}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                    {task.assigned_to && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--primary-light)' }}>
                        @{task.assignee?.full_name}
                      </span>
                    )}
                    {task.due_date && (
                      <span style={{ 
                        fontSize: '0.8rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' 
                      }}>
                        <Clock size={12} />
                        {new Date(task.due_date).toLocaleDateString()}
                        {isOverdue && ' (Overdue)'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Task">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Task Title</label>
            <input 
              type="text" 
              className="form-input" 
              value={form.title} 
              onChange={e => setForm({ ...form, title: e.target.value })} 
              placeholder="e.g. Buy rice and dal" 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Assign To (Optional)</label>
            <select className="form-input" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Anyone</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Due Date (Optional)</label>
            <input 
              type="date" 
              className="form-input" 
              value={form.due_date} 
              onChange={e => setForm({ ...form, due_date: e.target.value })} 
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>Save</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
