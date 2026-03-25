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

// Derive teams from matches + any manually-added teams on the tournament doc.
// fromDate: only include teams with a match on or after this date.
export const getTournamentTeams = async (tournamentId, fromDate = null) => {
  const [matchSnap, tournamentSnap] = await Promise.all([
    getDocs(collection(db, 'tournaments', tournamentId, 'matches')),
    getDoc(doc(db, 'tournaments', tournamentId)),
  ])

  const map = new Map()

  // 1. Teams from matches
  for (const d of matchSnap.docs) {
    const m = d.data()
    if (fromDate && m.date && m.date < fromDate) continue
    if (m.homeTeam?.id && m.homeTeam?.name) map.set(m.homeTeam.id, m.homeTeam)
    if (m.awayTeam?.id && m.awayTeam?.name) map.set(m.awayTeam.id, m.awayTeam)
  }

  // 2. Manually-added teams (fill gaps from incomplete API data)
  for (const t of (tournamentSnap.data()?.manualTeams || [])) {
    if (t.id && t.name && !map.has(t.id)) map.set(t.id, t)
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'he'))
}

export const getTournamentPlayers = async (tournamentId) => {
  const q = query(
    collection(db, 'tournaments', tournamentId, 'players'),
    orderBy('name')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}
