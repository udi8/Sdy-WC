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
  getLeagueTeams,
  getTeamPlayers,
  getSeasonMatches,
} from '../api/sportsDb'

// TheSportsDB encodes qualifying rounds with round numbers > 200 (e.g. 400).
// Main tournament phases (group stage, knockouts) use round ≤ 200.
const MAX_ROUND = 200

// For these tournaments the participant list is fixed before any match is played.
// lookup_all_teams returns the correct roster, so we merge it in to fill gaps
// when the events feed is truncated by the free tier.
const ROSTER_BASED = new Set(['4429', '4421', '4422', '4423', '4415'])

/**
 * Import a tournament — saves matches + teams only (no players).
 * Use importTournamentPlayers() separately to import players in two halves.
 */
export const importTournament = async (league, season, fromDate = null) => {
  const tournamentId = String(league.idLeague)
  if (!tournamentId || tournamentId === 'undefined') {
    throw new Error('League ID is missing')
  }
  const name = league.strLeague || league.strLeagueAlternate || '—'

  await setDoc(doc(db, 'tournaments', tournamentId), {
    id: tournamentId,
    name,
    season,
    fromDate: fromDate || null,
    emblem: league.strBadge || league.strLogo || null,
    area:   league.strCountry || null,
    sport:  league.strSport   || 'Soccer',
    status: 'setup',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  const teams = await importMatches(tournamentId, season)

  if (ROSTER_BASED.has(tournamentId)) {
    await mergeRosterTeams(tournamentId, teams)
  }

  return tournamentId
}

/**
 * Import players for a tournament in two halves to avoid API rate limits.
 * @param {string} tournamentId
 * @param {'AL' | 'MZ'} half  — 'AL' = teams A–L, 'MZ' = teams M–Z
 */
export const importTournamentPlayers = async (tournamentId, half) => {
  // Read teams from existing matches subcollection
  const snap = await getDocs(collection(db, 'tournaments', tournamentId, 'matches'))
  const teamsMap = new Map()
  for (const d of snap.docs) {
    const m = d.data()
    if (m.homeTeam?.id && m.homeTeam?.name) teamsMap.set(m.homeTeam.id, m.homeTeam)
    if (m.awayTeam?.id && m.awayTeam?.name) teamsMap.set(m.awayTeam.id, m.awayTeam)
  }
  // Also supplement from roster for roster-based tournaments
  if (ROSTER_BASED.has(tournamentId)) {
    await mergeRosterTeams(tournamentId, teamsMap)
  }

  const isFirstHalf = (name) => {
    const ch = name.trim()[0]?.toUpperCase() || 'A'
    return ch <= 'L'
  }

  const filtered = new Map(
    [...teamsMap.entries()].filter(([, t]) =>
      half === 'AL' ? isFirstHalf(t.name) : !isFirstHalf(t.name)
    )
  )

  await savePlayersForTeams(tournamentId, filtered)
  return filtered.size
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

const mergeRosterTeams = async (tournamentId, teamsMap) => {
  let data
  try { data = await getLeagueTeams(tournamentId) } catch { return }
  for (const t of (data?.teams || [])) {
    if (!t.idTeam || !t.strTeam) continue
    if (!teamsMap.has(String(t.idTeam))) {
      teamsMap.set(String(t.idTeam), {
        id:    String(t.idTeam),
        name:  t.strTeam,
        badge: t.strBadge || null,
      })
    }
  }
}

const importMatches = async (tournamentId, season) => {
  let matchesData
  try { matchesData = await getSeasonMatches(tournamentId, season) } catch { return new Map() }
  const allEvents = matchesData?.events || []
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const fetchPlayersWithRetry = async (teamId) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await getTeamPlayers(teamId)
    } catch (err) {
      const is429 = err.message?.includes('429')
      if (!is429 || attempt === 2) return null
      await sleep((attempt + 1) * 2000)
    }
  }
  return null
}

const savePlayersForTeams = async (tournamentId, teamsMap) => {
  for (const [teamId, team] of teamsMap) {
    const playersData = await fetchPlayersWithRetry(teamId)
    await sleep(400)
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
