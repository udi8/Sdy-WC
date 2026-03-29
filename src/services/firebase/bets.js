import {
  doc, getDoc, setDoc, collection, getDocs,
  query, orderBy, serverTimestamp, where, updateDoc, increment,
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

// ─── Match bets (round bets) ─────────────────────────────────────────────────

const matchBetDocId = (userId, tournamentId) => `${tournamentId}_${userId}`

export const getMatchBet = async (userId, tournamentId) => {
  const ref = doc(db, 'matchBets', matchBetDocId(userId, tournamentId))
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

export const saveMatchBet = async (userId, tournamentId, matchId, home, away) => {
  const ref = doc(db, 'matchBets', matchBetDocId(userId, tournamentId))
  await setDoc(ref, {
    userId,
    tournamentId,
    [`bets.${matchId}`]: { home: Number(home), away: Number(away) },
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

// Admin: get all matchBet docs for a tournament
export const getAllMatchBets = async (tournamentId) => {
  const q = query(collection(db, 'matchBets'), where('tournamentId', '==', tournamentId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

// Admin: get all staticBet docs for a tournament
export const getAllStaticBets = async (tournamentId) => {
  const q = query(collection(db, 'staticBets'), where('tournamentId', '==', tournamentId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

// ─── Bet lock settings ───────────────────────────────────────────────────────
// Stored in Firestore: settings/global { betLockHours: 24 }
// A match is locked when: new Date(match.utcDate) - Date.now() < betLockHours * 3600000

const SETTINGS_DOC = () => doc(db, 'settings', 'global')

export const getBetLockHours = async () => {
  const snap = await getDoc(SETTINGS_DOC())
  return snap.exists() ? (snap.data().betLockHours ?? 24) : 24
}

export const saveBetLockHours = async (hours) => {
  await setDoc(SETTINGS_DOC(), { betLockHours: Number(hours) }, { merge: true })
}

// Helper: is a match currently locked for betting?
// utcDate: ISO string e.g. "2026-06-12T20:00:00Z"
// betLockHours: number (default 24)
export const isMatchLocked = (match, betLockHours = 24) => {
  if (match.locked === true) return true
  if (!match.utcDate) return false
  const msUntilStart = new Date(match.utcDate).getTime() - Date.now()
  return msUntilStart < betLockHours * 3600 * 1000
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

// Calculate points for a single match bet vs actual result
// Returns: 7 (exact), 5 (direction+diff), 3 (direction only), 0 (wrong)
export const scoreMatchBet = (bet, result) => {
  if (bet == null || result == null) return 0
  const { home: bH, away: bA } = bet
  const { home: rH, away: rA } = result
  if (bH === rH && bA === rA) return 7
  const betDir   = bH > bA ? 'H' : bH < bA ? 'A' : 'D'
  const realDir  = rH > rA ? 'H' : rH < rA ? 'A' : 'D'
  if (betDir !== realDir) return 0
  if (Math.abs(bH - bA) === Math.abs(rH - rA)) return 5
  return 3
}

// Admin: submit a match result and update all bettors' leaderboard entries
export const submitMatchResult = async (tournamentId, matchId, homeScore, awayScore) => {
  const homeNum = Number(homeScore)
  const awayNum = Number(awayScore)

  // 1. Update match doc
  const matchRef = doc(db, 'tournaments', tournamentId, 'matches', matchId)
  await updateDoc(matchRef, {
    'score.home': homeNum,
    'score.away': awayNum,
    status: 'finished',
    updatedAt: serverTimestamp(),
  })

  // 2. Fetch all matchBet docs for this tournament
  const allBets = await getAllMatchBets(tournamentId)

  // 3. Calculate and write leaderboard points for each user
  const result = { home: homeNum, away: awayNum }
  const writes = allBets.map(async (userBet) => {
    const matchBet = userBet.bets?.[matchId]
    if (matchBet == null) return
    const pts = scoreMatchBet(matchBet, result)
    if (pts === 0) return
    const lbRef = doc(db, 'tournaments', tournamentId, 'leaderboard', userBet.userId)
    await setDoc(lbRef, {
      matchPoints: increment(pts),
      totalPoints: increment(pts),
      updatedAt: serverTimestamp(),
    }, { merge: true })
  })
  await Promise.all(writes)

  return allBets.length  // number of bettors processed
}
