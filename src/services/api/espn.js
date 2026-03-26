// ESPN public API — no API key, no CORS proxy, 139 leagues.
// Docs: https://github.com/pseudo-r/Public-ESPN-API

const SITE = 'https://site.api.espn.com/apis/site/v2/sports'

const espnFetch = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN API ${res.status}: ${url}`)
  return res.json()
}

export const fetchESPNTeams      = (sport, league)         => espnFetch(`${SITE}/${sport}/${league}/teams?limit=100`)
export const fetchESPNRoster     = (sport, league, teamId) => espnFetch(`${SITE}/${sport}/${league}/teams/${teamId}?enable=roster`)
export const fetchESPNScoreboard = (sport, league, date)   => espnFetch(`${SITE}/${sport}/${league}/scoreboard?limit=1000${date ? `&dates=${date}` : ''}`)

// Fetch all events for a date range in one call (e.g. '20260601-20260719').
// ESPN supports the YYYYMMDD-YYYYMMDD range format in the dates param.
export const fetchESPNDateRange  = (sport, league, from, to) =>
  espnFetch(`${SITE}/${sport}/${league}/scoreboard?limit=1000&dates=${from}-${to}`)

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
