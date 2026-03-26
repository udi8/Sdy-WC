import {
  collection,
  doc,
  getDoc,
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
import {
  fetchFDCompetition,
  fetchFDTeams,
  fetchFDMatches,
  fetchFDLiveMatches,
} from '../api/footballData'
import {
  fetchESPNTeams,
  fetchESPNRoster,
  fetchESPNScoreboard,
  espnMapStatus,
} from '../api/espn'

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

// ─── football-data.org import ─────────────────────────────────────────────────

const fdMapStatus = (s) => {
  if (!s) return 'scheduled'
  const l = s.toLowerCase()
  if (l === 'finished')                        return 'finished'
  if (l === 'in_play' || l === 'paused')       return 'live'
  if (l === 'postponed' || l === 'cancelled')  return 'postponed'
  return 'scheduled'
}

/**
 * Import a full tournament from football-data.org via Cloudflare Worker.
 * Writes tournament doc + matches + players (from squad data) to Firestore.
 * Requires VITE_FOOTBALL_DATA_WORKER_URL in .env.
 *
 * @param {string} competitionCode  e.g. 'WC', 'CL', 'PL'
 * @param {string} season           e.g. '2026' or '2025'
 * @returns {{ tournamentId, name, matchCount, playerCount }}
 */
export const importFromFootballData = async (competitionCode, season) => {
  const code = competitionCode.trim().toUpperCase()

  // 1. Competition metadata
  const compData    = await fetchFDCompetition(code)
  const tournamentId = String(compData.id)
  const name        = compData.name
  const emblem      = compData.emblem || null
  const area        = compData.area?.name || null

  // 2. Teams + squads (free tier: 10 req/min — add delay between calls)
  const teamsData = await fetchFDTeams(code, season)
  const teams     = teamsData.teams || []
  await new Promise((r) => setTimeout(r, 600))

  // 3. Matches
  const matchesData = await fetchFDMatches(code, season)
  const matches     = matchesData.matches || []

  // ── Write tournament doc ──────────────────────────────────────────────────
  await setDoc(doc(db, 'tournaments', tournamentId), {
    id:              tournamentId,
    name,
    season,
    emblem,
    area,
    sport:           'Soccer',
    status:          'setup',
    playerChunks:    [],
    manualTeams:     [],
    competitionCode: code,
    createdAt:       serverTimestamp(),
    updatedAt:       serverTimestamp(),
  })

  // ── Write matches ─────────────────────────────────────────────────────────
  let batch = writeBatch(db)
  let count = 0
  for (const m of matches) {
    const ref  = doc(db, 'tournaments', tournamentId, 'matches', String(m.id))
    const home = { id: String(m.homeTeam.id), name: m.homeTeam.shortName || m.homeTeam.name }
    const away = { id: String(m.awayTeam.id), name: m.awayTeam.shortName || m.awayTeam.name }
    batch.set(ref, {
      id:       String(m.id),
      date:     m.utcDate ? m.utcDate.slice(0, 10) : null,
      time:     m.utcDate ? m.utcDate.slice(11, 16) : null,
      status:   fdMapStatus(m.status),
      round:    m.matchday || null,
      stage:    m.stage    || null,
      group:    m.group    || null,
      homeTeam: home,
      awayTeam: away,
      score: {
        home: m.score?.fullTime?.home ?? null,
        away: m.score?.fullTime?.away ?? null,
      },
      locked: false,
    })
    count++
    if (count === 490) { await batch.commit(); batch = writeBatch(db); count = 0 }
  }
  if (count > 0) await batch.commit()

  // ── Write players (from squad data) ──────────────────────────────────────
  let playerCount = 0
  for (const team of teams) {
    const squad = team.squad || []
    if (squad.length === 0) continue
    let pb = writeBatch(db); let pc = 0
    for (const p of squad) {
      const ref = doc(db, 'tournaments', tournamentId, 'players', String(p.id))
      pb.set(ref, {
        id:          String(p.id),
        name:        p.name        || '',
        position:    p.position    || null,
        nationality: p.nationality || null,
        teamId:      String(team.id),
        teamName:    team.shortName || team.name,
      })
      pc++; playerCount++
      if (pc === 490) { await pb.commit(); pb = writeBatch(db); pc = 0 }
    }
    if (pc > 0) await pb.commit()
  }

  return { tournamentId, name, matchCount: matches.length, playerCount }
}

/**
 * Refresh live match scores for a football-data.org–imported tournament.
 * Only updates matches currently marked as LIVE by the API.
 *
 * @param {string} tournamentId      Firestore tournament doc ID (= competition id)
 * @param {string} competitionCode   e.g. 'WC', 'CL'
 * @returns {number} count of matches updated
 */
export const refreshLiveScores = async (tournamentId, competitionCode) => {
  const data    = await fetchFDLiveMatches(competitionCode)
  const matches = data.matches || []
  if (matches.length === 0) return 0

  let batch = writeBatch(db)
  let count = 0
  for (const m of matches) {
    const ref = doc(db, 'tournaments', tournamentId, 'matches', String(m.id))
    batch.update(ref, {
      status:       fdMapStatus(m.status),
      'score.home': m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
      'score.away': m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
      updatedAt:    serverTimestamp(),
    })
    count++
    if (count === 490) { await batch.commit(); batch = writeBatch(db); count = 0 }
  }
  if (count > 0) await batch.commit()
  return matches.length
}

export { TOTAL_PLAYER_CHUNKS }

// ─── ESPN import ──────────────────────────────────────────────────────────────

/**
 * Import a tournament from ESPN's public API (no API key required).
 * Sweeps scoreboard week-by-week between startDate and endDate.
 *
 * @param {string} sport       e.g. 'soccer'
 * @param {string} league      e.g. 'isr.1', 'eng.1', 'fifa.world'
 * @param {string} startDate   ISO date 'YYYY-MM-DD'
 * @param {string} endDate     ISO date 'YYYY-MM-DD'
 * @returns {{ tournamentId, name, matchCount, playerCount }}
 */
export const importFromESPN = async (sport, league, startDate, endDate) => {
  const tournamentId = `espn_${sport}_${league}_${startDate.slice(0, 4)}`

  // Build list of weekly date strings to sweep
  const dates = []
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 7)) {
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''))
  }

  // Fetch scoreboard weeks + teams endpoint in parallel
  // Teams endpoint is fallback when no matches exist yet (future tournaments)
  const [teamsData, ...scoreboards] = await Promise.all([
    fetchESPNTeams(sport, league).catch(() => null),
    ...dates.map((dt) => fetchESPNScoreboard(sport, league, dt)),
  ])

  // Deduplicate events across weeks
  const eventsMap = {}
  for (const sb of scoreboards) {
    for (const event of (sb.events || [])) eventsMap[event.id] = event
  }
  const events = Object.values(eventsMap)

  // Derive league name from first scoreboard that has it
  const name = scoreboards.find((sb) => sb.leagues?.[0]?.name)?.leagues?.[0]?.name
    || `${sport}/${league}`

  // Placeholder pattern — covers TBD, Winner/Loser qualifiers, playoff slots, etc.
  const PLACEHOLDER = /winner|loser|runner.?up|tbd|playoff|qualifier|intercontinental|\bic\b|^\s*[\d\s]+\s*$/i
  const isRealTeam  = (t) => t?.id && !PLACEHOLDER.test(t.displayName || '') && !PLACEHOLDER.test(t.shortDisplayName || '')

  // Primary: teams endpoint (comprehensive, correct count for the tournament)
  // Filter placeholders that ESPN sometimes includes (playoff slots, qualifiers)
  const endpointTeams = (teamsData?.sports?.[0]?.leagues?.[0]?.teams?.map((t) => t.team) || [])
    .filter(isRealTeam)

  // Supplement: teams seen in actual matches (used to detect eliminated teams when importing mid-season)
  const matchTeamIds = new Set()
  for (const event of events) {
    const comp = event.competitions?.[0]
    if (!comp) continue
    const [h, a] = comp.competitors || []
    if (isRealTeam(h?.team)) matchTeamIds.add(String(h.team.id))
    if (isRealTeam(a?.team)) matchTeamIds.add(String(a.team.id))
  }

  // If matches exist AND start date is after today, filter to only teams still playing
  // Otherwise use the full endpoint list (pre-tournament or current season)
  const today = new Date().toISOString().slice(0, 10)
  const filterByMatches = matchTeamIds.size > 0 && startDate > today
  const teamsList = filterByMatches
    ? endpointTeams.filter((t) => matchTeamIds.has(String(t.id)))
    : endpointTeams

  // Write tournament doc
  await setDoc(doc(db, 'tournaments', tournamentId), {
    id:           tournamentId,
    name,
    season:       startDate.slice(0, 4),
    sport,
    status:       'setup',
    playerChunks: [],
    manualTeams:  [],
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
  })

  // Write matches
  let batch = writeBatch(db)
  let count = 0
  for (const event of events) {
    const comp = event.competitions?.[0]
    if (!comp) continue
    const [h, a] = comp.competitors || []
    if (!h || !a) continue
    if (!isRealTeam(h.team) || !isRealTeam(a.team)) continue   // skip TBD/placeholder matches
    const ref = doc(db, 'tournaments', tournamentId, 'matches', String(event.id))
    batch.set(ref, {
      id:       String(event.id),
      date:     event.date?.slice(0, 10) || null,
      time:     event.date?.slice(11, 16) || null,
      status:   espnMapStatus(event.status?.type?.name),
      round:    event.week?.number || null,
      homeTeam: { id: String(h.team.id), name: h.team.shortDisplayName || h.team.displayName },
      awayTeam: { id: String(a.team.id), name: a.team.shortDisplayName || a.team.displayName },
      score: {
        home: h.score != null ? Number(h.score) : null,
        away: a.score != null ? Number(a.score) : null,
      },
      locked: false,
    })
    count++
    if (count === 490) { await batch.commit(); batch = writeBatch(db); count = 0 }
  }
  if (count > 0) await batch.commit()

  // Fetch rosters only for teams that appear in matches
  const CONCURRENCY = 5
  let playerCount = 0
  for (let i = 0; i < teamsList.length; i += CONCURRENCY) {
    const slice   = teamsList.slice(i, i + CONCURRENCY)
    const rosters = await Promise.all(
      slice.map((t) => fetchESPNRoster(sport, league, t.id).catch((err) => {
        console.warn(`ESPN roster failed for team ${t.id}:`, err.message)
        return null
      }))
    )
    for (let j = 0; j < slice.length; j++) {
      const rosterData = rosters[j]
      // ESPN returns athletes as position groups: [{ items: [player, ...] }, ...]
      const groups   = rosterData?.team?.athletes || rosterData?.athletes || []
      const athletes = groups.flatMap((g) => g.items || g)
      if (athletes.length === 0) continue
      const team = slice[j]
      let pb = writeBatch(db); let pc = 0
      for (const a of athletes) {
        const ref = doc(db, 'tournaments', tournamentId, 'players', String(a.id))
        pb.set(ref, {
          id:          String(a.id),
          name:        a.fullName || a.displayName || '',
          position:    a.position?.abbreviation || a.position?.displayName || null,
          nationality: a.citizenship || null,
          teamId:      String(team.id),
          teamName:    team.shortDisplayName || team.displayName || '',
        })
        pc++; playerCount++
        if (pc === 490) { await pb.commit(); pb = writeBatch(db); pc = 0 }
      }
      if (pc > 0) await pb.commit()
    }
  }

  return { tournamentId, name, matchCount: events.length, playerCount }
}
