// football-data.org — free tier, used on non-match days
const BASE_URL = 'https://api.football-data.org/v4'
const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_API_KEY

const headers = { 'X-Auth-Token': API_KEY }

const fetchFD = async (path) => {
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  if (!res.ok) throw new Error(`football-data.org error: ${res.status}`)
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
