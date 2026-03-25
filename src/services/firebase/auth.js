import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider)

export const signOutUser = () => signOut(auth)

// Create or fetch user profile in Firestore
export const createUserProfile = async (user, extraData = {}) => {
  const userRef = doc(db, 'users', user.uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    const { displayName, email, photoURL } = user
    await setDoc(userRef, {
      displayName,
      email,
      photoURL,
      role: 'pending',        // pending → approved → blocked
      status: 'pending_age',  // pending_age → pending_approval → active → blocked
      createdAt: serverTimestamp(),
      ...extraData,
    })
  }

  return userRef
}

export const getUserProfile = async (uid) => {
  const userRef = doc(db, 'users', uid)
  const snapshot = await getDoc(userRef)
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}
