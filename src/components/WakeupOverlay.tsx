import { useEffect, useRef } from 'react'
import SnakeGame from './SnakeGame'
import { BellRing } from 'lucide-react'

interface WakeupOverlayProps {
  onDismiss: () => void
  targetScore?: number
}

export default function WakeupOverlay({ onDismiss, targetScore = 5 }: WakeupOverlayProps) {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Generate an annoying alarm beep using Web Audio API
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    const audioCtx = new AudioContextClass()
    audioCtxRef.current = audioCtx

    const playBeep = () => {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume()
      }
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()

      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime) // High pitched beep
      
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime) // Loud
      
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)

      oscillator.start()
      oscillator.stop(audioCtx.currentTime + 0.3) // Beep for 300ms
    }

    // Play beep every 600ms
    intervalRef.current = window.setInterval(playBeep, 600)
    // Try playing first one immediately
    playBeep()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (audioCtxRef.current) audioCtxRef.current.close()
    }
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-default)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      animation: 'pulse-bg 2s infinite'
    }}>
      <style>{`
        @keyframes pulse-bg {
          0% { background-color: var(--bg-default); }
          50% { background-color: rgba(239, 68, 68, 0.1); }
          100% { background-color: var(--bg-default); }
        }
      `}</style>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <BellRing size={32} color="var(--danger)" className="pulse-icon" />
        <h1 style={{ color: 'var(--danger)', margin: 0 }}>WAKE UP!</h1>
      </div>
      
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Play Snake and reach score {targetScore} to turn off the alarm.
      </p>

      <SnakeGame 
        targetScore={targetScore} 
        onWin={onDismiss} 
      />
    </div>
  )
}
