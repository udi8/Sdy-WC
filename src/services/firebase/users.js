import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

export const getAllUsers = async () => {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const updateUserStatus = async (uid, status, role) => {
  const userRef = doc(db, 'users', uid)
  const updates = { status, updatedAt: serverTimestamp() }
  if (role) updates.role = role
  await updateDoc(userRef, updates)
}

export const approveUser = (uid) =>
  updateUserStatus(uid, 'active', 'member')

export const blockUser = (uid) =>
  updateUserStatus(uid, 'blocked', null)

export const setAdminRole = (uid) =>
  updateUserStatus(uid, 'active', 'admin')

export const rejectUnderage = (uid) =>
  updateUserStatus(uid, 'rejected_underage', 'none')
