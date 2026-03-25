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

  // 2. Fetch & save teams + players
  await importTeamsAndPlayers(tournamentId)

  // 3. Fetch & save matches
  await importMatches(tournamentId, season)

  return tournamentId
}

const importTeamsAndPlayers = async (tournamentId) => {
  const data = await getLeagueTeams(tournamentId)
  const teams = data.teams || []
  if (teams.length === 0) return

  const teamBatch = writeBatch(db)
  for (const team of teams) {
    const ref = doc(db, 'tournaments', tournamentId, 'teams', String(team.idTeam))
    teamBatch.set(ref, {
      id:        String(team.idTeam),
      name:      team.strTeam        || '',
      shortName: team.strTeamShort   || team.strTeam || '',
      badge:     team.strBadge       || team.strLogo || null,
      country:   team.strCountry     || null,
      stadium:   team.strStadium     || null,
    })
  }
  await teamBatch.commit()

  // Players per team — separate batches
  for (const team of teams) {
    let playersData
    try { playersData = await getTeamPlayers(String(team.idTeam)) } catch { continue }
    const players = playersData.player || []
    if (players.length === 0) continue

    let batch = writeBatch(db)
    let count = 0
    for (const p of players) {
      const ref = doc(db, 'tournaments', tournamentId, 'players', String(p.idPlayer))
      batch.set(ref, {
        id:          String(p.idPlayer),
        name:        p.strPlayer       || '',
        position:    p.strPosition     || null,
        nationality: p.strNationality  || null,
        teamId:      String(team.idTeam),
        teamName:    team.strTeam      || '',
        teamBadge:   team.strBadge     || null,
      })
      count++
      if (count === 490) { await batch.commit(); batch = writeBatch(db); count = 0 }
    }
    if (count > 0) await batch.commit()
  }
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

const importMatches = async (tournamentId, season) => {
  let matchesData
  try { matchesData = await getSeasonMatches(tournamentId, season) } catch { return }
  const events = matchesData.events || []
  if (events.length === 0) return

  let batch = writeBatch(db)
  let count = 0

  for (const e of events) {
    const ref = doc(db, 'tournaments', tournamentId, 'matches', String(e.idEvent))
    batch.set(ref, {
      id:       String(e.idEvent),
      date:     e.dateEvent || null,
      time:     e.strTime   || null,
      status:   mapStatus(e.strStatus),
      round:    e.intRound  ? Number(e.intRound)  : null,
      homeTeam: { id: String(e.idHomeTeam || ''), name: e.strHomeTeam || '' },
      awayTeam: { id: String(e.idAwayTeam || ''), name: e.strAwayTeam || '' },
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
