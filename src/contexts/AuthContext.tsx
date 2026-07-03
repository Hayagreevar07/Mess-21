import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import { supabase } from '../lib/supabase'
import type { Profile, Role } from '../lib/types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  role: Role | null
  loading: boolean
  needsProfile: boolean
  signInWithGoogle: () => Promise<User>
  signOut: () => Promise<void>
  createProfile: (fullName: string, role: Role) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsProfile, setNeedsProfile] = useState(false)

  const fetchProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()

    if (data && !error) {
      setProfile(data as Profile)
      setNeedsProfile(false)
    } else {
      setProfile(null)
      setNeedsProfile(true)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid)
      } else {
        setProfile(null)
        setNeedsProfile(false)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setProfile(null)
    setNeedsProfile(false)
  }

  const createProfile = async (fullName: string, role: Role) => {
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from('profiles').insert({
      id: user.uid,
      full_name: fullName,
      email: user.email || '',
      role,
      avatar_url: user.photoURL || null,
    })
    if (error) throw error
    await fetchProfile(user.uid)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        loading,
        needsProfile,
        signInWithGoogle,
        signOut,
        createProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
