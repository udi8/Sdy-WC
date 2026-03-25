import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import {
  getLeagueTeams,
  getTeamPlayers,
  getSeasonMatches,
} from '../api/sportsDb'

const MAX_ROUND = 200
const TOTAL_PLAYER_CHUNKS = 5

const ROSTER_BASED = new Set(['4429', '4421', '4422', '4423', '4415'])

/**
 * Import tournament matches + teams only (no players).
 * Players are imported separately via importTournamentPlayers().
 */
export const importTournament = async (league, season, fromDate = null) => {
  const tournamentId = String(league.idLeague)
  if (!tournamentId || tournamentId === 'undefined') throw new Error('League ID is missing')
  const name = league.strLeague || league.strLeagueAlternate || '—'

  await setDoc(doc(db, 'tournaments', tournamentId), {
    id: tournamentId,
    name,
    season,
    fromDate:      fromDate || null,
    emblem:        league.strBadge || league.strLogo || null,
    area:          league.strCountry || null,
    sport:         league.strSport   || 'Soccer',
    status:        'setup',
    playerChunks:  [],   // which of the 5 player-import chunks are done
    createdAt:     serverTimestamp(),
    updatedAt:     serverTimestamp(),
  })

  const teams = await importMatches(tournamentId, season)
  if (ROSTER_BASED.has(tournamentId)) {
    await mergeRosterTeams(tournamentId, teams)
  }

  return tournamentId
}

/**
 * Import players for one chunk (1–5) of the tournament's teams.
 * Teams are sorted alphabetically and split into TOTAL_PLAYER_CHUNKS equal parts.
 * On success, marks the chunk as done in the tournament doc (playerChunks array).
 *
 * @returns {number} count of teams processed
 */
export const importTournamentPlayers = async (tournamentId, chunkNum) => {
  // 1. Read teams from matches
  const snap = await getDocs(collection(db, 'tournaments', tournamentId, 'matches'))
  const teamsMap = new Map()
  for (const d of snap.docs) {
    const m = d.data()
    if (m.homeTeam?.id && m.homeTeam?.name) teamsMap.set(m.homeTeam.id, m.homeTeam)
    if (m.awayTeam?.id && m.awayTeam?.name) teamsMap.set(m.awayTeam.id, m.awayTeam)
  }
  if (ROSTER_BASED.has(tournamentId)) {
    await mergeRosterTeams(tournamentId, teamsMap)
  }

  // 2. Sort teams alphabetically, take this chunk's slice
  const sorted = Array.from(teamsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const total = sorted.length
  const size  = Math.ceil(total / TOTAL_PLAYER_CHUNKS)
  const from  = (chunkNum - 1) * size
  const slice = sorted.slice(from, from + size)

  // 3. Fetch & save players for this slice
  await savePlayersForTeams(
    tournamentId,
    new Map(slice.map((t) => [t.id, t]))
  )

  // 4. Mark chunk as done in the tournament doc
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    playerChunks: arrayUnion(chunkNum),
    updatedAt: serverTimestamp(),
  })

  return slice.length
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    const ref  = doc(db, 'tournaments', tournamentId, 'matches', String(e.idEvent))
    const home = { id: String(e.idHomeTeam || ''), name: e.strHomeTeam || '' }
    const away = { id: String(e.idAwayTeam || ''), name: e.strAwayTeam || '' }

    if (home.id && home.name) teamsMap.set(home.id, home)
    if (away.id && away.name) teamsMap.set(away.id, away)

    batch.set(ref, {
      id: String(e.idEvent),
      date:     e.dateEvent || null,
      time:     e.strTime   || null,
      status:   mapStatus(e.strStatus),
      round:    e.intRound ? Number(e.intRound) : null,
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

/**
 * Add teams manually to a tournament (fills gaps from incomplete API data).
 * Each name becomes a team with a stable ID derived from the name.
 * Existing API-sourced teams with the same name are not duplicated
 * (IDs differ, but getTournamentTeams shows all).
 *
 * @param {string}   tournamentId
 * @param {string[]} names  - array of team name strings
 */
export const addManualTeams = async (tournamentId, names) => {
  const teams = names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({
      id:     'manual_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name,
      manual: true,
    }))
  if (teams.length === 0) return 0

  // Store as array on the tournament doc (replace whole array to avoid dupes)
  const ref  = doc(db, 'tournaments', tournamentId)
  const snap = await getDoc(ref)
  const existing = (snap.data()?.manualTeams || [])
  const existingIds = new Set(existing.map((t) => t.id))
  const newTeams = teams.filter((t) => !existingIds.has(t.id))
  if (newTeams.length === 0) return 0

  await updateDoc(ref, {
    manualTeams: [...existing, ...newTeams],
    updatedAt: serverTimestamp(),
  })
  return newTeams.length
}

export const activateTournament = (tournamentId) =>
  updateDoc(doc(db, 'tournaments', tournamentId), {
    status: 'active', updatedAt: serverTimestamp(),
  })

export const deactivateTournament = (tournamentId) =>
  updateDoc(doc(db, 'tournaments', tournamentId), {
    status: 'finished', updatedAt: serverTimestamp(),
  })

export { TOTAL_PLAYER_CHUNKS }
