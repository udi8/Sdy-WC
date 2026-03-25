// API-Football — 100 calls/day, used on match days only
const BASE_URL = 'https://v3.football.api-sports.io'
const API_KEY = import.meta.env.VITE_API_FOOTBALL_KEY

const headers = {
  'x-rapidapi-host': 'v3.football.api-sports.io',
  'x-rapidapi-key': API_KEY,
}

const fetchAF = async (path) => {
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`)
  return res.json()
}

// Returns all live fixtures right now
export const getLiveFixtures = () => fetchAF('/fixtures?live=all')

// Returns fixtures for a specific date (YYYY-MM-DD)
export const getFixturesByDate = (date) => fetchAF(`/fixtures?date=${date}`)

// Returns fixture details including events (goals, cards)
export const getFixtureDetails = (fixtureId) =>
  fetchAF(`/fixtures?id=${fixtureId}`)
