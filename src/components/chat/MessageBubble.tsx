import { format } from 'date-fns'
import { Check, CheckCheck } from 'lucide-react'

interface MessageBubbleProps {
  message: {
    id: string
    content: string
    created_at: string
    sender_id: string
    media_url?: string | null
    media_type?: string | null
    is_read?: boolean
    profiles?: {
      full_name: string
      avatar_url: string | null
    }
  }
  isMine: boolean
}

export default function MessageBubble({ message, isMine }: MessageBubbleProps) {
  const time = format(new Date(message.created_at), 'HH:mm')
  const senderName = message.profiles?.full_name || 'Unknown User'
  const avatarUrl = message.profiles?.avatar_url
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: isMine ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: '8px',
      marginBottom: '4px'
    }}>
      {!isMine && (
        <div style={{ 
          width: 32, 
          height: 32, 
          borderRadius: '50%', 
          background: 'var(--bg-glass-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
          ) : (
            senderName.charAt(0).toUpperCase()
          )}
        </div>
      )}
      
      <div style={{
        maxWidth: '75%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start'
      }}>
        {!isMine && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px', marginBottom: '2px' }}>
            {senderName}
          </span>
        )}
        <div style={{
          background: isMine ? 'linear-gradient(135deg, #10b981, #059669)' : '#ffffff',
          color: isMine ? '#fff' : '#1f2937',
          padding: message.media_type === 'image' ? '4px' : '10px 14px',
          borderRadius: '20px',
          borderBottomRightRadius: isMine ? '4px' : '20px',
          borderBottomLeftRadius: !isMine ? '4px' : '20px',
          boxShadow: isMine ? '0 4px 12px rgba(16,185,129,0.2)' : '0 4px 12px rgba(0,0,0,0.08)',
          position: 'relative',
          wordBreak: 'break-word',
          overflow: 'hidden',
          border: isMine ? 'none' : '1px solid rgba(0,0,0,0.05)',
          maxWidth: '100%'
        }}>
          
          {/* Media Content */}
          {message.media_type === 'image' && message.media_url && (
            <img 
              src={message.media_url} 
              alt="Shared Media" 
              style={{ width: '100%', borderRadius: '16px', display: 'block', maxHeight: '280px', objectFit: 'cover' }} 
            />
          )}
          {message.media_type === 'audio' && message.media_url && (
            <div style={{ 
              background: isMine ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)', 
              borderRadius: '16px', 
              padding: '4px',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <audio 
                controls 
                src={message.media_url} 
                style={{ 
                  height: '36px', 
                  maxWidth: '220px',
                  outline: 'none',
                  filter: isMine ? 'invert(1) hue-rotate(180deg) contrast(1.5)' : 'none' // Hack to make native audio player fit dark/light theme
                }} 
              />
            </div>
          )}

          {/* Text Content */}
          {message.content && (
            <div style={{ padding: message.media_type === 'image' ? '8px 10px 2px 10px' : '0' }}>
              <span style={{ fontSize: '0.95rem', lineHeight: '1.4' }}>{message.content}</span>
            </div>
          )}

          <div style={{ 
            fontSize: '0.65rem', 
            fontWeight: 500,
            opacity: 0.8, 
            marginTop: '4px',
            textAlign: 'right',
            display: 'inline-flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '4px',
            width: '100%',
            color: isMine ? 'rgba(255,255,255,0.9)' : '#6b7280',
            padding: message.media_type === 'image' ? '0 10px 4px 10px' : '0'
          }}>
            {time}
            {isMine && (
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {message.is_read ? (
                  <CheckCheck size={14} color="#38bdf8" /> // Blue double tick for read
                ) : (
                  <Check size={14} color="rgba(255,255,255,0.7)" /> // Single tick for sent
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
