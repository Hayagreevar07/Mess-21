import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { PushNotifications } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
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
  signInWithEmail: (email: string, pass: string) => Promise<User>
  signUpWithEmail: (email: string, pass: string) => Promise<User>
  signOut: () => Promise<void>
  createProfile: (fullName: string, role: Role, repId?: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsProfile, setNeedsProfile] = useState(false)

  const fetchProfile = async (uid: string) => {
    try {
      // 6-second timeout for database fetch on mobile startup
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single()

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 6000)
      )

      const { data, error } = (await Promise.race([fetchPromise, timeoutPromise])) as any

      if (data && !error) {
        setProfile(data as Profile)
        setNeedsProfile(false)
        if (Capacitor.isNativePlatform()) {
          registerPushNotifications(uid)
        }
      } else {
        setProfile(null)
        setNeedsProfile(true)
      }
    } catch (err) {
      console.error('fetchProfile error:', err)
      setProfile(null)
      // If we fail to fetch (e.g. offline), don't lock on setup page
      setNeedsProfile(false)
    }
  }

  const registerPushNotifications = async (uid: string) => {
    try {
      const permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive === 'prompt') {
        const newStatus = await PushNotifications.requestPermissions()
        if (newStatus.receive !== 'granted') return
      } else if (permStatus.receive !== 'granted') {
        return
      }

      const localPermStatus = await LocalNotifications.checkPermissions()
      if (localPermStatus.display === 'prompt') {
        await LocalNotifications.requestPermissions()
      }

      await PushNotifications.removeAllListeners()
      await PushNotifications.register()

      PushNotifications.addListener('registration', async (token) => {
        await supabase.from('profiles').update({ fcm_token: token.value }).eq('id', uid)
      })
    } catch (error) {
      console.error('Push Notifications error:', error)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser)
        if (firebaseUser) {
          await fetchProfile(firebaseUser.uid)
        } else {
          setProfile(null)
          setNeedsProfile(false)
        }
      } catch (err) {
        console.error('onAuthStateChanged error:', err)
      } finally {
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
      const result = await FirebaseAuthentication.signInWithGoogle()
      const credential = GoogleAuthProvider.credential(result.credential?.idToken)
      const userCredential = await signInWithCredential(auth, credential)
      return userCredential.user
    } else {
      const result = await signInWithPopup(auth, googleProvider)
      return result.user
    }
  }

  const signInWithEmail = async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email, pass)
    return result.user
  }

  const signUpWithEmail = async (email: string, pass: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, pass)
    return result.user
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setProfile(null)
    setNeedsProfile(false)
  }

  const createProfile = async (fullName: string, role: Role, repId?: string) => {
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from('profiles').insert({
      id: user.uid,
      full_name: fullName,
      email: user.email || '',
      role,
      rep_id: repId || null,
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
        signInWithEmail,
        signUpWithEmail,
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
