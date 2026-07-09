import { useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { useLocation, useNavigate } from 'react-router-dom'

export default function GlobalChatListener() {
  const { profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!profile) return

    const channel = supabase
      .channel('global:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new
          
          // Don't notify if I sent it
          if (msg.sender_id === profile.id) return
          
          // Don't notify if I'm currently on the messages page
          if (location.pathname === '/messages') return

          // Notify if it's a direct message to me, or a group message
          const isGroupMessage = msg.receiver_id === null
          const isDirectMessage = msg.receiver_id === profile.id

          if (isGroupMessage || isDirectMessage) {
            // Fetch sender info
            const { data: sender } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', msg.sender_id)
              .single()

            const senderName = sender?.full_name || 'Someone'
            const messagePreview = msg.media_type ? `Sent a ${msg.media_type}` : msg.content

            toast.custom(
              (t) => (
                <div
                  className={`${
                    t.visible ? 'animate-enter' : 'animate-leave'
                  } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    borderRadius: '16px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    toast.dismiss(t.id)
                    navigate('/messages')
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                     {sender?.avatar_url ? (
                        <img src={sender.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ color: '#fff', fontWeight: 600 }}>{senderName.charAt(0)}</span>
                      )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {senderName} {isGroupMessage ? '(Group)' : ''}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                      {messagePreview}
                    </p>
                  </div>
                </div>
              ),
              { duration: 4000, position: 'top-center' }
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, location.pathname, navigate])

  return null
}
