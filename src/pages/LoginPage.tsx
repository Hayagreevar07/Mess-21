import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UtensilsCrossed } from 'lucide-react'
import toast from 'react-hot-toast'

const FOOD_EMOJIS = ['🍛', '🍚', '🥘', '☕', '🍳', '🫕', '🍲', '🥞', '🍿', '🧁', '🍜', '🫖', '🍽️', '🥗', '🍱', '🫙']

export default function LoginPage() {
  const { user, profile, loading, signInWithGoogle, needsProfile } = useAuth()
  const [submitting, setSubmitting] = useState(false)

  // Generate random positions for floating emojis
  const floatingItems = useMemo(() =>
    FOOD_EMOJIS.map((emoji, i) => ({
      emoji,
      left: `${(i * 6.25) + Math.random() * 3}%`,
      delay: `${i * 1.2 + Math.random() * 2}s`,
      duration: `${12 + Math.random() * 8}s`,
      size: `${1.2 + Math.random() * 1}rem`,
    })),
  [])

  if (loading) return null
  if (user && profile && !needsProfile) return <Navigate to="/dashboard" replace />
  if (user && needsProfile) return <Navigate to="/setup" replace />

  const handleGoogleSignIn = async () => {
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error(err.message || 'Sign-in failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Animated Mesh Background */}
      <div className="auth-bg-mesh">
        <div className="mesh-orb"></div>
        <div className="mesh-orb"></div>
        <div className="mesh-orb"></div>
      </div>

      {/* Floating Food Emojis */}
      <div className="floating-emojis">
        {floatingItems.map((item, i) => (
          <span
            key={i}
            className="float-emoji"
            style={{
              left: item.left,
              animationDelay: item.delay,
              animationDuration: item.duration,
              fontSize: item.size,
            }}
          >
            {item.emoji}
          </span>
        ))}
      </div>

      <div className="auth-container" style={{ position: 'relative', zIndex: 1 }}>
        <div className="auth-header">
          <div className="auth-logo">
            <UtensilsCrossed size={40} />
          </div>
          <h1>MessManager</h1>
          <p>Your mess, simplified ✨</p>
        </div>

        <div className="auth-form">
          <button
            className="btn btn-google btn-full"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            id="google-signin-btn"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {submitting ? 'Signing in...' : 'Continue with Google'}
          </button>

          <div className="auth-divider">
            <span>Secure sign-in powered by Google</span>
          </div>

          <div className="auth-features">
            <div className="auth-feature">
              <span className="auth-feature-emoji">🍽️</span>
              <span>Track daily meals — Dosa, Idli, Biryani & more</span>
            </div>
            <div className="auth-feature">
              <span className="auth-feature-emoji">💰</span>
              <span>Auto-calculate mess bills & manage budgets</span>
            </div>
            <div className="auth-feature">
              <span className="auth-feature-emoji">👥</span>
              <span>3 roles — Admin, Representative & Member</span>
            </div>
            <div className="auth-feature">
              <span className="auth-feature-emoji">📱</span>
              <span>Works beautifully on phone & desktop</span>
            </div>
          </div>
        </div>

        <p className="auth-footer">
          Built with ❤️ for mess management
        </p>
      </div>
    </div>
  )
}
