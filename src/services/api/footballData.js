// football-data.org — via Cloudflare Worker CORS proxy
//
// One-time Cloudflare setup (~5 min):
//   1. Sign up at cloudflare.com (free)
//   2. cd workers/football-proxy && npx wrangler deploy
//   3. npx wrangler secret put FOOTBALL_DATA_API_KEY   (paste your key)
//   4. Copy the worker URL → add to .env as VITE_FOOTBALL_DATA_WORKER_URL

const WORKER_URL = (import.meta.env.VITE_FOOTBALL_DATA_WORKER_URL || '').replace(/\/$/, '')

export const fdFetch = async (path) => {
  if (!WORKER_URL) throw new Error('VITE_FOOTBALL_DATA_WORKER_URL not set in .env')
  const res = await fetch(`${WORKER_URL}${path}`)
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${path}`)
  return res.json()
}

// ─── Competition import helpers ───────────────────────────────────────────────
export const fetchFDCompetition = (code)         => fdFetch(`/competitions/${code}`)
export const fetchFDTeams       = (code, season) => fdFetch(`/competitions/${code}/teams?season=${season}`)
export const fetchFDMatches     = (code, season) => fdFetch(`/competitions/${code}/matches?season=${season}`)
export const fetchFDLiveMatches = (code)         => fdFetch(`/competitions/${code}/matches?status=LIVE`)

// ─── Live polling helpers ─────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10)
export const getTodayMatches = () => fdFetch(`/matches?dateFrom=${today()}&dateTo=${today()}`)
