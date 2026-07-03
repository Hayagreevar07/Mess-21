import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../lib/types'
import Loader from './Loader'

interface Props {
  children: React.ReactNode
  requiredRole?: Role[]
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, profile, loading, needsProfile } = useAuth()

  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  if (needsProfile) return <Navigate to="/setup" replace />
  if (requiredRole && profile && !requiredRole.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
