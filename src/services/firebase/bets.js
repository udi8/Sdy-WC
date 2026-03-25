import {
  doc, getDoc, setDoc, collection, getDocs,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from './config'

// ─── Static bets ─────────────────────────────────────────────────────────────

const staticBetId = (userId, tournamentId) => `${tournamentId}_${userId}`

export const getStaticBet = async (userId, tournamentId) => {
  const ref = doc(db, 'staticBets', staticBetId(userId, tournamentId))
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

export const saveStaticBet = async (userId, tournamentId, data) => {
  const ref = doc(db, 'staticBets', staticBetId(userId, tournamentId))
  await setDoc(ref, {
    userId,
    tournamentId,
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

// ─── Tournament data helpers ──────────────────────────────────────────────────

export const getTournamentTeams = async (tournamentId) => {
  const q = query(
    collection(db, 'tournaments', tournamentId, 'teams'),
    orderBy('name')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

export const getTournamentPlayers = async (tournamentId) => {
  const q = query(
    collection(db, 'tournaments', tournamentId, 'players'),
    orderBy('name')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}
