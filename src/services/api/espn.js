/**
 * ESPN Public API — no API key required, no CORS proxy needed.
 * Covers 139 leagues across 17 sports.
 * Docs: https://github.com/pseudo-r/Public-ESPN-API
 */

const SITE = 'https://site.api.espn.com/apis/site/v2/sports'

const espnFetch = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN API ${res.status}: ${url}`)
  return res.json()
}

// All teams for a league (id, name, logos)
export const fetchESPNTeams = (sport, league) =>
  espnFetch(`${SITE}/${sport}/${league}/teams?limit=100`)

// Full roster for a single team
export const fetchESPNRoster = (sport, league, teamId) =>
  espnFetch(`${SITE}/${sport}/${league}/teams/${teamId}?enable=roster`)

// Scoreboard for a given date (YYYYMMDD). Omit date for current day.
export const fetchESPNScoreboard = (sport, league, date) =>
  espnFetch(`${SITE}/${sport}/${league}/scoreboard?limit=1000${date ? `&dates=${date}` : ''}`)

// ─── Status mapping ────────────────────────────────────────────────────────────

export const espnMapStatus = (typeName) => {
  if (!typeName) return 'scheduled'
  switch (typeName) {
    case 'STATUS_FINAL':
    case 'STATUS_FULL_TIME':
      return 'finished'
    case 'STATUS_IN_PROGRESS':
    case 'STATUS_HALFTIME':
      return 'live'
    case 'STATUS_POSTPONED':
    case 'STATUS_CANCELLED':
      return 'postponed'
    default:
      return 'scheduled'
  }
}
