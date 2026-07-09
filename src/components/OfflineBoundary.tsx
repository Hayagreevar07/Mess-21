import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import SnakeGame from './SnakeGame'
import { WifiOff } from 'lucide-react'

interface OfflineBoundaryProps {
  children: ReactNode
}

export default function OfflineBoundary({ children }: OfflineBoundaryProps) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (isOffline) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-default)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '10vh'
      }}>
        <WifiOff size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
        <h1 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>You're Offline</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
          Play some Snake while you wait for your connection to return!
        </p>
        
        <SnakeGame isOfflineMode={true} />
      </div>
    )
  }

  return <>{children}</>
}
