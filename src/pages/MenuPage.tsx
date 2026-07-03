import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { MenuItem, MenuCategory } from '../lib/types'
import Modal from '../components/Modal'
import { Plus, Search, UtensilsCrossed, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const categories: { value: MenuCategory; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch', label: 'Lunch', emoji: '☀️' },
  { value: 'dinner', label: 'Dinner', emoji: '🌙' },
  { value: 'snack', label: 'Snacks', emoji: '🍿' },
]

// Map menu item names to emojis for visual flair
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

export default function MenuPage() {
  const { role } = useAuth()
  const [items, setItems] = useState<MenuItem[]>([])
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([])
  const [activeCategory, setActiveCategory] = useState<MenuCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [form, setForm] = useState({
    name: '',
    price: '',
    category: 'breakfast' as MenuCategory,
  })

  useEffect(() => {
    fetchItems()
  }, [])

  useEffect(() => {
    let filtered = items
    if (activeCategory !== 'all') {
      filtered = filtered.filter(i => i.category === activeCategory)
    }
    if (search) {
      filtered = filtered.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase())
      )
    }
    setFilteredItems(filtered)
  }, [items, activeCategory, search])

  const fetchItems = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .order('category')
      .order('name')
    setItems((data as MenuItem[]) || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name || !form.price) return toast.error('Fill all fields')

    if (editItem) {
      const { error } = await supabase
        .from('menu_items')
        .update({
          name: form.name,
          price: parseFloat(form.price),
          category: form.category,
        })
        .eq('id', editItem.id)
      if (error) return toast.error(error.message)
      toast.success('Item updated! ✨')
    } else {
      const { error } = await supabase.from('menu_items').insert({
        name: form.name,
        price: parseFloat(form.price),
        category: form.category,
      })
      if (error) return toast.error(error.message)
      toast.success('Item added! 🎉')
    }

    setModalOpen(false)
    setEditItem(null)
    setForm({ name: '', price: '', category: 'breakfast' })
    fetchItems()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return
    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Item deleted!')
    fetchItems()
  }

  const openEdit = (item: MenuItem) => {
    setEditItem(item)
    setForm({
      name: item.name,
      price: String(item.price),
      category: item.category,
    })
    setModalOpen(true)
  }

  const openAdd = () => {
    setEditItem(null)
    setForm({ name: '', price: '', category: 'breakfast' })
    setModalOpen(true)
  }

  // Count items per category
  const categoryCounts = categories.map(cat => ({
    ...cat,
    count: items.filter(i => i.category === cat.value).length,
  }))

  return (
    <div className="page menu-page">
      <div className="page-header">
        <div>
          <h1>Menu</h1>
          <p className="page-subtitle">
            {items.length} items across {categories.length} categories
          </p>
        </div>
        {role === 'admin' && (
          <button className="btn btn-primary" onClick={openAdd} id="menu-add-btn">
            <Plus size={18} /> Add Item
          </button>
        )}
      </div>

      <div className="search-bar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search dosa, biryani, tea..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          id="menu-search"
        />
      </div>

      <div className="category-tabs">
        <button
          className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          🍽️ All ({items.length})
        </button>
        {categoryCounts.map(cat => (
          <button
            key={cat.value}
            className={`category-tab ${activeCategory === cat.value ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.value)}
          >
            {cat.emoji} {cat.label} ({cat.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="menu-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton" style={{ height: '88px', borderRadius: '12px' }}></div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <UtensilsCrossed size={48} />
          <p>{search ? `No items matching "${search}"` : 'No menu items found'}</p>
          {role === 'admin' && (
            <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: '12px' }}>
              <Plus size={16} /> Add First Item
            </button>
          )}
        </div>
      ) : (
        <div className="menu-grid">
          {filteredItems.map(item => (
            <div key={item.id} className="menu-item-card tilt-hover">
              <span className="menu-item-emoji">{getFoodEmoji(item.name)}</span>
              <div className="menu-item-info">
                <span className="menu-item-name">{item.name}</span>
                <span className="menu-item-price">₹{item.price}</span>
                <span className={`menu-item-category cat-${item.category}`}>
                  {item.category}
                </span>
              </div>
              {role === 'admin' && (
                <div className="menu-item-actions">
                  <button className="btn-icon" onClick={() => openEdit(item)} title="Edit">
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(item.id)}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Edit Menu Item' : 'Add Menu Item'}
      >
        <div className="modal-form">
          <div className="form-group">
            <label className="form-label">Item Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Masala Dosa"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
            {form.name && (
              <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Preview: {getFoodEmoji(form.name)} {form.name}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Price (₹)</label>
            <input
              type="number"
              className="form-input"
              placeholder="e.g. 30"
              value={form.price}
              onChange={e => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value as MenuCategory })}
            >
              {categories.map(c => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-full" onClick={handleSave}>
            {editItem ? '✨ Update Item' : '🎉 Add Item'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
