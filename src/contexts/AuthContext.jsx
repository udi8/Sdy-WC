import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../services/firebase/config'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(undefined) // undefined = loading
  const [userProfile, setUserProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      if (!user) {
        setUserProfile(null)
        setProfileLoading(false)
      }
    })
    return unsubAuth
  }, [])

  // Real-time listener on user profile
  useEffect(() => {
    if (!firebaseUser) return
    setProfileLoading(true)

    const userRef = doc(db, 'users', firebaseUser.uid)
    const unsubProfile = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setUserProfile({ id: snap.id, ...snap.data() })
      } else {
        setUserProfile(null)
      }
      setProfileLoading(false)
    })

    return unsubProfile
  }, [firebaseUser])

  const isLoading = firebaseUser === undefined || profileLoading
  const isAdmin = userProfile?.role === 'admin'
  const isMember = userProfile?.role === 'member'
  const isApproved = isAdmin || isMember
  const isPendingAge = userProfile?.status === 'pending_age'
  const isPendingApproval = userProfile?.status === 'pending_approval'

  const value = {
    firebaseUser,
    userProfile,
    isLoading,
    isAdmin,
    isMember,
    isApproved,
    isPendingAge,
    isPendingApproval,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
