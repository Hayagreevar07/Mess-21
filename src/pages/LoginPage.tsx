import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

const FOOD_EMOJIS = ['🍛', '🍚', '🥘', '☕', '🍳', '🫕', '🍲', '🥞', '🍿', '🧁', '🍜', '🫖', '🍽️', '🥗', '🍱', '🫙']

export default function LoginPage() {
  const { user, profile, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, needsProfile } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Please enter email and password')
    if (password.length < 6) return toast.error('Password must be at least 6 characters')
    
    setSubmitting(true)
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password)
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed')
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

      <div className="auth-container" style={{ position: 'relative', zIndex: 1, padding: '28px 24px' }}>
          <div className="auth-header" style={{ marginBottom: '24px' }}>
            <div className="auth-logo">
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 800,
                fontSize: '1.8rem',
                fontFamily: 'serif',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}>S</div>
            </div>
            <h1>Scheward</h1>
            <p>SINCE 2026</p>
          </div>

        <div className="auth-form">
          <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '42px' }}
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '42px' }}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={submitting}
            >
              {submitting ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              </span>
              <button
                type="button"
                className="btn-link"
                style={{ marginLeft: '6px', color: 'var(--primary-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </form>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <button
            className="btn btn-google btn-full"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            type="button"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  )
}
