import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import {
  getLeagueTeams,
  getTeamPlayers,
  getSeasonMatches,
} from '../api/sportsDb'

/**
 * Import a tournament from TheSportsDB into Firebase.
 * @param {object} league  - TheSportsDB league object (idLeague, strLeague, ...)
 * @param {string} season  - Season string e.g. "2025-2026" or "2026"
 */
export const importTournament = async (league, season) => {
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
    emblem: league.strBadge || league.strLogo || null,
    area:   league.strCountry || null,
    sport:  league.strSport   || 'Soccer',
    status: 'setup',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // 2. Fetch & save matches first (source of truth for teams)
  const teams = await importMatches(tournamentId, season)

  // 3. Save teams derived from matches + their players
  await importPlayers(tournamentId, teams)

  return tournamentId
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

// Import matches and return unique teams derived from them
const importMatches = async (tournamentId, season) => {
  let matchesData
  try { matchesData = await getSeasonMatches(tournamentId, season) } catch { return new Map() }
  const events = matchesData?.events || []
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
