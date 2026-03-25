// football-data.org — free tier
// Free tier only allows localhost — use Firebase Cloud Function proxy in production
const BASE_URL = 'https://api.football-data.org/v4'
const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_API_KEY

// Cloud Function URL (europe-west1 matches Firestore region)
const PROXY_URL = import.meta.env.VITE_FOOTBALL_PROXY_URL ||
  'https://footballproxy-boq5bqmnbq-ew.a.run.app'

const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

const fetchFD = async (path) => {
  if (isLocalhost) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'X-Auth-Token': API_KEY },
    })
    if (!res.ok) throw new Error(`football-data.org error: ${res.status}`)
    return res.json()
  }

  // Production: route through Cloud Function proxy
  const res = await fetch(`${PROXY_URL}?path=${encodeURIComponent('/v4' + path)}`)
  if (!res.ok) throw new Error(`proxy error: ${res.status}`)
  return res.json()
}

// Returns all available competitions (used for search)
export const getAllCompetitions = () => fetchFD('/competitions')

export const getCompetition = (id) => fetchFD(`/competitions/${id}`)

export const getCompetitionTeams = (id) => fetchFD(`/competitions/${id}/teams`)

export const getCompetitionMatches = (id) => fetchFD(`/competitions/${id}/matches`)

export const getCompetitionScorers = (id) =>
  fetchFD(`/competitions/${id}/scorers?limit=50`)

export const getMatch = (id) => fetchFD(`/matches/${id}`)

export const getTodayMatches = () =>
  fetchFD(`/matches?dateFrom=${today()}&dateTo=${today()}`)

const today = () => new Date().toISOString().slice(0, 10)
