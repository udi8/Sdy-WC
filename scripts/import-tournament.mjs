/**
 * Import tournament data from football-data.org into Firestore.
 * Runs inside GitHub Actions — no CORS restrictions.
 *
 * Env vars (all set as GitHub Secrets):
 *   FOOTBALL_DATA_API_KEY  — football-data.org API key
 *   FIREBASE_SERVICE_ACCOUNT — Firebase service account JSON (stringified)
 *   FIREBASE_PROJECT_ID    — Firebase project ID
 *   COMPETITION            — competition code e.g. WC, CL, PL
 *   SEASON                 — season year e.g. 2026 (single) or 2025 (for 2025-26)
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// ─── Config ───────────────────────────────────────────────────────────────────

const API_KEY     = process.env.FOOTBALL_DATA_API_KEY
const COMPETITION = process.env.COMPETITION || 'WC'
const SEASON      = process.env.SEASON || '2026'
const PROJECT_ID  = process.env.FIREBASE_PROJECT_ID || 'sdy-wc'

if (!API_KEY) { console.error('Missing FOOTBALL_DATA_API_KEY'); process.exit(1) }

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
initializeApp({ credential: cert(sa), projectId: PROJECT_ID })
const db = getFirestore()

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE = 'https://api.football-data.org/v4'

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': API_KEY },
  })
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${path}`)
  return res.json()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n▶ Importing ${COMPETITION} season ${SEASON} → Firestore (${PROJECT_ID})\n`)

  // 1. Competition info
  const compData = await apiFetch(`/competitions/${COMPETITION}`)
  const name     = compData.name
  const area     = compData.area?.name || ''
  const emblem   = compData.emblem || null
  const tournamentId = String(compData.id)

  console.log(`  Competition: ${name} (id=${tournamentId})`)

  // 2. Teams + squads
  console.log('  Fetching teams...')
  const teamsData = await apiFetch(`/competitions/${COMPETITION}/teams?season=${SEASON}`)
  const teams     = teamsData.teams || []
  console.log(`  → ${teams.length} teams found`)

  // 3. Matches
  await sleep(500)
  console.log('  Fetching matches...')
  const matchesData = await apiFetch(`/competitions/${COMPETITION}/matches?season=${SEASON}`)
  const matches     = matchesData.matches || []
  console.log(`  → ${matches.length} matches found`)

  // ── Write tournament doc ──────────────────────────────────────────────────
  const tournamentRef = db.collection('tournaments').doc(tournamentId)
  await tournamentRef.set({
    id:           tournamentId,
    name,
    season:       SEASON,
    emblem,
    area,
    sport:        'Soccer',
    status:       'setup',
    playerChunks: [],
    manualTeams:  [],
    createdAt:    FieldValue.serverTimestamp(),
    updatedAt:    FieldValue.serverTimestamp(),
  }, { merge: true })

  // ── Write matches ─────────────────────────────────────────────────────────
  console.log('  Writing matches...')
  let batch = db.batch()
  let count = 0

  for (const m of matches) {
    const ref = tournamentRef.collection('matches').doc(String(m.id))
    const home = { id: String(m.homeTeam.id), name: m.homeTeam.shortName || m.homeTeam.name }
    const away = { id: String(m.awayTeam.id), name: m.awayTeam.shortName || m.awayTeam.name }
    batch.set(ref, {
      id:       String(m.id),
      date:     m.utcDate ? m.utcDate.slice(0, 10) : null,
      time:     m.utcDate ? m.utcDate.slice(11, 16) : null,
      status:   mapStatus(m.status),
      round:    m.matchday || null,
      stage:    m.stage || null,
      group:    m.group || null,
      homeTeam: home,
      awayTeam: away,
      score: {
        home: m.score?.fullTime?.home ?? null,
        away: m.score?.fullTime?.away ?? null,
      },
      locked: false,
    })
    count++
    if (count === 490) { await batch.commit(); batch = db.batch(); count = 0 }
  }
  if (count > 0) await batch.commit()
  console.log(`  ✓ ${matches.length} matches written`)

  // ── Write players (from squad data) ──────────────────────────────────────
  console.log('  Writing players...')
  let playerCount = 0

  for (const team of teams) {
    const squad = team.squad || []
    if (squad.length === 0) continue

    let pb = db.batch(); let pc = 0
    for (const p of squad) {
      const ref = tournamentRef.collection('players').doc(String(p.id))
      pb.set(ref, {
        id:          String(p.id),
        name:        p.name || '',
        position:    p.position || null,
        nationality: p.nationality || null,
        teamId:      String(team.id),
        teamName:    team.shortName || team.name,
      })
      pc++; playerCount++
      if (pc === 490) { await pb.commit(); pb = db.batch(); pc = 0 }
    }
    if (pc > 0) await pb.commit()
  }
  console.log(`  ✓ ${playerCount} players written`)

  console.log(`\n✅ Done! Tournament "${name}" imported successfully.\n`)
}

function mapStatus(s) {
  if (!s) return 'scheduled'
  const l = s.toLowerCase()
  if (l === 'finished') return 'finished'
  if (l === 'in_play' || l === 'paused') return 'live'
  if (l === 'postponed' || l === 'cancelled') return 'postponed'
  return 'scheduled'
}

run().catch((err) => { console.error('\n❌', err.message); process.exit(1) })
