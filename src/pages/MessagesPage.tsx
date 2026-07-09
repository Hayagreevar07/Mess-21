import { useState, useEffect, useRef } from 'react'
import { Send, Users, Paperclip, Mic, ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import MessageBubble from '../components/chat/MessageBubble'
import { useQuery } from '@tanstack/react-query'
import { uploadMedia, AudioRecorder } from '../lib/media'
import toast from 'react-hot-toast'

export default function MessagesPage() {
  const { profile } = useAuth()
  
  // View states
  const [activeChat, setActiveChat] = useState<string | null>(null) // null = inbox, 'group' = group, '<id>' = dm
  const [activeChatName, setActiveChatName] = useState('Messages')
  
  // Message states
  const [content, setContent] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [audioRecorder] = useState(() => new AudioRecorder())

  // Fetch all profiles for Inbox view
  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      let query = supabase.from('profiles').select('*').neq('id', profile?.id).order('full_name')
      
      if (profile?.role === 'representative') {
        query = query.eq('rep_id', profile.id)
      } else if (profile?.role === 'member') {
        if (profile.rep_id) {
          query = query.or(`id.eq.${profile.rep_id},rep_id.eq.${profile.rep_id}`)
        }
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!profile && !activeChat,
  })

  // Fetch messages for active chat
  const { data: initialMessages, isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', activeChat],
    queryFn: async () => {
      let query = supabase
        .from('messages')
        .select(`id, content, created_at, sender_id, media_url, media_type, receiver_id, profiles:sender_id(full_name, avatar_url)`)
        .order('created_at', { ascending: true })
        .limit(100)

      if (activeChat === 'group') {
        const groupId = profile?.role === 'representative' ? `group_${profile.id}` : (profile?.rep_id ? `group_${profile.rep_id}` : 'group_global')
        query = query.eq('receiver_id', groupId)
      } else {
        // DM between me and activeChat
        query = query.or(`and(sender_id.eq.${profile?.id},receiver_id.eq.${activeChat}),and(sender_id.eq.${activeChat},receiver_id.eq.${profile?.id})`)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!profile && !!activeChat,
  })

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages)
    }
  }, [initialMessages])

  // Real-time subscription
  useEffect(() => {
    if (!profile || !activeChat) return

    const channel = supabase
      .channel(`chat:${activeChat}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const currentGroupId = profile?.role === 'representative' ? `group_${profile.id}` : (profile?.rep_id ? `group_${profile.rep_id}` : 'group_global')
          // Filter out messages that don't belong to this view
          if (activeChat === 'group' && payload.new.receiver_id !== currentGroupId) return
          if (activeChat !== 'group') {
            const isRelevantDM = 
              (payload.new.sender_id === profile.id && payload.new.receiver_id === activeChat) ||
              (payload.new.sender_id === activeChat && payload.new.receiver_id === profile.id)
            if (!isRelevantDM) return
          }

          // Fetch sender profile info
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single()
            
          const newMessage: any = { ...payload.new, profiles: senderProfile }
          setMessages((prev) => {
            // Prevent duplicates from optimistic updates (checking exact same content and close time, or just rely on id if we can)
            // Since optimistic ID is 'temp-x' and real ID is UUID, we can filter out temp messages when the real one arrives
            // or just ensure no exact same text in the last 2 seconds.
            const isDuplicate = prev.some(m => m.id === newMessage.id || (m.content === newMessage.content && m.sender_id === newMessage.sender_id && Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000))
            if (isDuplicate) return prev
            return [...prev, newMessage]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile, activeChat])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, uploading])

  const openChat = (id: string, name: string) => {
    setActiveChat(id)
    setActiveChatName(name)
  }

  const closeChat = () => {
    setActiveChat(null)
    setActiveChatName('Messages')
  }

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !profile) return
    const text = content
    setContent('')
    await sendMessage(text, null, null)
  }

  const sendMessage = async (text: string, mediaUrl: string | null, mediaType: string | null) => {
    const groupId = profile?.role === 'representative' ? `group_${profile.id}` : (profile?.rep_id ? `group_${profile.rep_id}` : 'group_global')
    // Optimistic UI Update
    const tempId = `temp-${Date.now()}`
    const optimisticMessage = {
      id: tempId,
      content: text,
      created_at: new Date().toISOString(),
      sender_id: profile?.id,
      receiver_id: activeChat === 'group' ? groupId : activeChat,
      media_url: mediaUrl,
      media_type: mediaType,
      profiles: {
        full_name: profile?.full_name,
        avatar_url: null // Or profile?.avatar_url if available
      }
    }
    
    setMessages(prev => [...prev, optimisticMessage])

    const { error } = await supabase.from('messages').insert({
      sender_id: profile?.id,
      content: text,
      receiver_id: activeChat === 'group' ? groupId : activeChat,
      media_url: mediaUrl,
      media_type: mediaType
    }).select().single()

    if (error) {
      toast.error('Failed to send message')
      console.error(error)
      // Revert optimistic update
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } else {
      // We don't strictly need to replace it because realtime will fetch it, but to prevent duplicates from realtime:
      // Actually, since we added it optimistically, when realtime fires, it will be added again.
      // We should filter duplicates by checking if a message with same content and very close timestamp exists, 
      // or rely on Realtime. Since realtime can be flaky, optimistic + deduping in realtime listener is best.
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    
    const fileName = `${profile?.id}-${Date.now()}-${file.name}`
    const url = await uploadMedia(file, fileName)
    
    if (url) {
      await sendMessage('', url, 'image')
    } else {
      toast.error('Image upload failed')
    }
    setUploading(false)
  }

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false)
      setUploading(true)
      const audioBlob = await audioRecorder.stop()
      if (audioBlob) {
        const fileName = `${profile?.id}-${Date.now()}.webm`
        const url = await uploadMedia(audioBlob, fileName)
        if (url) {
          await sendMessage('', url, 'audio')
        } else {
          toast.error('Audio upload failed')
        }
      }
      setUploading(false)
    } else {
      const started = await audioRecorder.start()
      if (started) {
        setIsRecording(true)
      } else {
        toast.error('Microphone access denied')
      }
    }
  }

  // Inbox View
  if (!activeChat) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <div className="page-header" style={{ padding: '16px', background: 'var(--bg-glass-strong)', backdropFilter: 'blur(10px)', zIndex: 10 }}>
          <h1 className="page-title">Messages</h1>
        </div>
        
        <div style={{ padding: '16px', overflowY: 'auto' }}>
          {/* Group Chat Item */}
          <div 
            onClick={() => openChat('group', 'Group Chat')}
            className="card group-chat-card" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              padding: '16px', 
              marginBottom: '20px', 
              cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }}>
              <Users size={28} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Group Chat</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Your Representative & Members</p>
            </div>
          </div>

          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', paddingLeft: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Direct Messages</h3>
          
          {loadingContacts ? (
            <div className="loader" style={{ margin: 'auto' }}></div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {contacts?.map(contact => (
                <div 
                  key={contact.id} 
                  onClick={() => openChat(contact.id, contact.full_name)}
                  className="card contact-card"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px', 
                    padding: '12px 16px', 
                    cursor: 'pointer', 
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-glass-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {contact.avatar_url ? (
                      <img src={contact.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      contact.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{contact.full_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary-light)' }}>{contact.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Active Chat View
  return <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-base)', zIndex: 9999 }}>
        {/* Chat Header */}
        <div className="page-header" style={{ 
          padding: '12px 16px', 
          background: 'rgba(20, 20, 20, 0.75)', 
          backdropFilter: 'blur(20px)', 
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 10,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <button className="btn-icon" onClick={closeChat} style={{ background: 'transparent', padding: '8px' }}>
            <ChevronLeft size={24} color="var(--primary-light)" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: activeChat === 'group' ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--bg-glass-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>
              {activeChat === 'group' ? <Users size={20} /> : activeChatName.charAt(0)}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{activeChatName}</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{activeChat === 'group' ? 'Group Chat' : 'Direct Message'}</span>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          className="chat-scroll-area"
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '20px 16px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            backgroundImage: 'radial-gradient(var(--bg-glass-strong) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0'
          }}
        >
        {loadingMessages ? (
          <div className="loader" style={{ margin: 'auto' }}></div>
        ) : (
          messages.map((msg) => (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              isMine={msg.sender_id === profile?.id} 
            />
          ))
        )}
        
        <div ref={messagesEndRef} />
      </div>

        {/* Input Area */}
        <div style={{ 
          padding: '12px 16px 24px 16px', 
          background: 'linear-gradient(to top, var(--bg-base) 60%, transparent)', 
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid transparent',
          zIndex: 10
        }}>
          {uploading && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', textAlign: 'center' }}>Uploading...</div>}
          <form onSubmit={handleSendText} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              background: 'var(--bg-card)', 
              borderRadius: '24px', 
              padding: '4px 8px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}>
              <label style={{ cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                <Paperclip size={20} />
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploading} />
              </label>
              
              <input
                type="text"
                placeholder="Message..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{ 
                  flex: 1, 
                  background: 'transparent', 
                  border: 'none', 
                  outline: 'none', 
                  padding: '10px 8px', 
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            {content.trim() ? (
              <button 
                type="submit" 
                disabled={uploading}
                style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #10b981, #059669)', 
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                  transition: 'transform 0.1s'
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Send size={20} style={{ marginLeft: '4px' }} />
              </button>
            ) : (
              <button 
                type="button" 
                onClick={toggleRecording}
                disabled={uploading}
                style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '50%', 
                  background: isRecording ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(135deg, #10b981, #059669)', 
                  border: isRecording ? '2px solid #10b981' : 'none',
                  color: isRecording ? '#10b981' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: isRecording ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s',
                  animation: isRecording ? 'pulse 1.5s infinite' : 'none'
                }}
              >
                <Mic size={22} />
              </button>
            )}
          </form>
        </div>
      </div>
}
