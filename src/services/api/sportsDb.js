// TheSportsDB — free tier, no API key, full CORS support
// Docs: https://www.thesportsdb.com/api.php
const BASE = 'https://www.thesportsdb.com/api/v1/json/3'

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`TheSportsDB error: ${res.status}`)
  return res.json()
}

// Search leagues by name
export const searchLeagues = (name) =>
  get(`/search_all_leagues.php?l=${encodeURIComponent(name)}`)

// Get all leagues (free tier limited — use getLeaguesBySport instead)
export const getAllLeagues = () => get('/all_leagues.php')

// Get all leagues in a sport — works on free tier
export const getLeaguesBySport = (sport) =>
  get(`/search_all_leagues.php?s=${encodeURIComponent(sport)}`)

// Get league details by ID
export const getLeague = (id) => get(`/lookupleague.php?id=${id}`)

// Get all teams in a league
export const getLeagueTeams = (leagueId) =>
  get(`/lookup_all_teams.php?id=${leagueId}`)

// Get all players in a team
export const getTeamPlayers = (teamId) =>
  get(`/lookup_all_players.php?id=${teamId}`)

// Get all matches in a season  e.g. season = "2024-2025" or "2024"
export const getSeasonMatches = (leagueId, season) =>
  get(`/eventsseason.php?id=${leagueId}&s=${season}`)

// Get next 15 events in a league
export const getNextEvents = (leagueId) =>
  get(`/eventsnextleague.php?id=${leagueId}`)

// Get last 15 events
export const getLastEvents = (leagueId) =>
  get(`/eventspastleague.php?id=${leagueId}`)

// Get live scores (free tier returns empty — for structure only)
export const getLiveScores = () => get('/livescore.php')

// Helper: generate season string from year e.g. 2024 → "2024-2025"
export const buildSeason = (year = new Date().getFullYear()) => {
  // Tournaments like World Cup use single year "2026"
  // Club leagues use "2024-2025"
  return `${year}-${year + 1}`
}
