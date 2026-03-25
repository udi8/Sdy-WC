import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import {
  getTeamPlayers,
  getSeasonMatches,
} from '../api/sportsDb'

// TheSportsDB encodes qualifying rounds with round numbers > 200 (e.g. 400).
// Main tournament phases (group stage, knockouts) use round ≤ 200.
const MAX_ROUND = 200

/**
 * Import a tournament from TheSportsDB into Firebase.
 * @param {object} league    - TheSportsDB league object (idLeague, strLeague, ...)
 * @param {string} season    - Season string e.g. "2025-2026" or "2026"
 * @param {string} [fromDate] - "YYYY-MM-DD" — teams in bets are derived from matches
 *                              on or after this date (to show only remaining teams)
 */
export const importTournament = async (league, season, fromDate = null) => {
  const tournamentId = String(league.idLeague)
  if (!tournamentId || tournamentId === 'undefined') {
    throw new Error('League ID is missing')
  }
  const name = league.strLeague || league.strLeagueAlternate || '—'

  const tournamentRef = doc(db, 'tournaments', tournamentId)

  // 1. Save tournament doc
  await setDoc(tournamentRef, {
    id: tournamentId,
    name,
    season,
    fromDate: fromDate || null,   // used by bets UI to show only remaining teams
    emblem: league.strBadge || league.strLogo || null,
    area:   league.strCountry || null,
    sport:  league.strSport   || 'Soccer',
    status: 'setup',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // 2. Fetch & save matches (source of truth for teams).
  //    Qualifying rounds (round > MAX_ROUND) are filtered out automatically.
  const teams = await importMatches(tournamentId, season)

  // 3. Save players for each team
  await importPlayers(tournamentId, teams)

  return tournamentId
}

/**
 * Delete a tournament and all its subcollection data (matches + players).
 */
export const deleteTournament = async (tournamentId) => {
  const deleteSubcollection = async (subcol) => {
    const snap = await getDocs(collection(db, 'tournaments', tournamentId, subcol))
    if (snap.empty) return
    let batch = writeBatch(db)
    let count = 0
    for (const d of snap.docs) {
      batch.delete(d.ref)
      count++
      if (count === 490) { await batch.commit(); batch = writeBatch(db); count = 0 }
    }
    if (count > 0) await batch.commit()
  }

  await deleteSubcollection('matches')
  await deleteSubcollection('players')
  await deleteDoc(doc(db, 'tournaments', tournamentId))
}

const mapStatus = (s) => {
  if (!s) return 'scheduled'
  const lower = s.toLowerCase()
  if (lower.includes('not started') || lower.includes('ns'))  return 'scheduled'
  if (lower.includes('live') || lower.includes('progress'))   return 'live'
  if (lower.includes('finished') || lower.includes('ft'))     return 'finished'
  if (lower.includes('postponed') || lower.includes('ppd'))   return 'postponed'
  return 'scheduled'
}

// Import ALL matches for the season and return unique teams.
// Qualifying rounds (intRound > MAX_ROUND) are excluded — they are
// pre-season mini-leagues irrelevant to the main tournament.
const importMatches = async (tournamentId, season) => {
  let matchesData
  try { matchesData = await getSeasonMatches(tournamentId, season) } catch { return new Map() }
  const allEvents = matchesData?.events || []
  // Exclude qualifying rounds (TheSportsDB encodes them as round > 200, e.g. 400)
  const events = allEvents.filter((e) => {
    const r = Number(e.intRound)
    return !r || r <= MAX_ROUND
  })
  if (events.length === 0) return new Map()

  const teamsMap = new Map()
  let batch = writeBatch(db)
  let count = 0

  for (const e of events) {
    const ref = doc(db, 'tournaments', tournamentId, 'matches', String(e.idEvent))
    const home = { id: String(e.idHomeTeam || ''), name: e.strHomeTeam || '' }
    const away = { id: String(e.idAwayTeam || ''), name: e.strAwayTeam || '' }

    if (home.id && home.name) teamsMap.set(home.id, home)
    if (away.id && away.name) teamsMap.set(away.id, away)

    batch.set(ref, {
      id: String(e.idEvent),
      date: e.dateEvent || null,
      time: e.strTime   || null,
      status: mapStatus(e.strStatus),
      round:  e.intRound ? Number(e.intRound) : null,
      homeTeam: home,
      awayTeam: away,
      score: {
        home: e.intHomeScore != null ? Number(e.intHomeScore) : null,
        away: e.intAwayScore != null ? Number(e.intAwayScore) : null,
      },
      locked: false,
    })
    count++
    if (count === 490) { await batch.commit(); batch = writeBatch(db); count = 0 }
  }
  if (count > 0) await batch.commit()
  return teamsMap
}

// Save players for each team derived from matches
const importPlayers = async (tournamentId, teamsMap) => {
  if (!teamsMap || teamsMap.size === 0) return

  for (const [teamId, team] of teamsMap) {
    let playersData
    try { playersData = await getTeamPlayers(teamId) } catch { continue }
    const players = playersData?.player || []
    if (players.length === 0) continue

    let batch = writeBatch(db)
    let count = 0
    for (const p of players) {
      const ref = doc(db, 'tournaments', tournamentId, 'players', String(p.idPlayer))
      batch.set(ref, {
        id:          String(p.idPlayer),
        name:        p.strPlayer      || '',
        position:    p.strPosition    || null,
        nationality: p.strNationality || null,
        teamId,
        teamName:    team.name,
      })
      count++
      if (count === 490) { await batch.commit(); batch = writeBatch(db); count = 0 }
    }
    if (count > 0) await batch.commit()
  }
}

export const activateTournament = (tournamentId) =>
  updateDoc(doc(db, 'tournaments', tournamentId), {
    status: 'active',
    updatedAt: serverTimestamp(),
  })

export const deactivateTournament = (tournamentId) =>
  updateDoc(doc(db, 'tournaments', tournamentId), {
    status: 'finished',
    updatedAt: serverTimestamp(),
  })
