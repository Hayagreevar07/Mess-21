import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { FileText, Plus, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../components/Modal'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function NotesPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', content: '' })

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const createNoteMutation = useMutation({
    mutationFn: async (newNote: { title: string, content: string }) => {
      const { error } = await supabase.from('notes').insert({
        title: newNote.title,
        content: newNote.content,
        user_id: profile?.id,
        is_private: true
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Note saved securely')
      setIsModalOpen(false)
      setForm({ title: '', content: '' })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create note')
    }
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.content.trim()) return toast.error('Note content is required')
    createNoteMutation.mutate(form)
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">Personal Notes</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Lock size={12} /> Private & Secure
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Add Note
        </button>
      </header>

      {isLoading ? (
        <div className="skeleton" style={{ height: '300px', borderRadius: '16px' }}></div>
      ) : !notes || notes.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} className="empty-icon" />
          <h3>No Notes Yet</h3>
          <p>Add personal notes, lists, or private expenses here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {notes.map(note => (
            <div key={note.id} className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{note.title || 'Untitled'}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Private Note">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Title (Optional)</label>
            <input 
              type="text" 
              className="form-input" 
              value={form.title} 
              onChange={e => setForm({ ...form, title: e.target.value })} 
              placeholder="e.g. Shopping List" 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Note Content</label>
            <textarea 
              className="form-input" 
              value={form.content} 
              onChange={e => setForm({ ...form, content: e.target.value })} 
              placeholder="Type your notes here..." 
              required
              rows={5}
            />
          </div>
          
          <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
            <Lock size={16} />
            This note will be strictly private and only visible to you.
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={createNoteMutation.isPending}>Save</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
