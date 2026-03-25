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

// Derive teams from matches.
// fromDate (optional "YYYY-MM-DD"): include only teams that appear in matches
// from that date onwards — so if admin sets "2026-03-01", only teams still
// active in the tournament from that stage appear.
export const getTournamentTeams = async (tournamentId, fromDate = null) => {
  const snap = await getDocs(collection(db, 'tournaments', tournamentId, 'matches'))
  const map = new Map()
  for (const d of snap.docs) {
    const m = d.data()
    if (fromDate && m.date && m.date < fromDate) continue
    if (m.homeTeam?.id && m.homeTeam?.name) map.set(m.homeTeam.id, m.homeTeam)
    if (m.awayTeam?.id && m.awayTeam?.name) map.set(m.awayTeam.id, m.awayTeam)
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
