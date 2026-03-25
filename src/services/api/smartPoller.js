/**
 * Smart API polling logic:
 * - No matches today         → use football-data.org only
 * - 30 min before match      → switch to API-Football
 * - During match             → poll API-Football every 3 minutes
 * - After all matches done   → back to football-data.org
 *
 * All results are written to Firebase so clients read from Firebase, not directly from APIs.
 */

import { doc, setDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getLiveFixtures, getFixturesByDate } from './apiFootball'
import { getTodayMatches } from './footballData'

const THIRTY_MIN = 30 * 60 * 1000
const THREE_MIN = 3 * 60 * 1000
const TEN_MIN = 10 * 60 * 1000

let pollerInterval = null
let currentMode = 'idle' // 'idle' | 'pre_match' | 'live' | 'post_match'

const todayStr = () => new Date().toISOString().slice(0, 10)

const msUntil = (utcDateStr) => new Date(utcDateStr).getTime() - Date.now()

export const startPoller = (tournamentId) => {
  if (pollerInterval) clearInterval(pollerInterval)
  runPollCycle(tournamentId)
  pollerInterval = setInterval(() => runPollCycle(tournamentId), TEN_MIN)
}

export const stopPoller = () => {
  if (pollerInterval) clearInterval(pollerInterval)
  pollerInterval = null
}

const runPollCycle = async (tournamentId) => {
  try {
    // Get today's matches for this tournament from Firebase
    const matchesRef = collection(db, 'tournaments', tournamentId, 'matches')
    const q = query(matchesRef, where('utcDate', '>=', todayStr()))
    const snap = await getDocs(q)
    const todayMatches = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.utcDate?.startsWith(todayStr()))

    if (todayMatches.length === 0) {
      // No matches today — just refresh competition data via football-data.org
      currentMode = 'idle'
      return
    }

    const now = Date.now()
    const upcoming = todayMatches.filter((m) => msUntil(m.utcDate) > 0)
    const live = todayMatches.filter((m) => m.status === 'IN_PLAY' || m.status === 'HALFTIME')
    const nextMatch = upcoming.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0]

    if (live.length > 0) {
      currentMode = 'live'
      await fetchAndStoreLiveData(tournamentId)
      // Re-schedule at 3-minute interval during live
      if (pollerInterval) clearInterval(pollerInterval)
      pollerInterval = setInterval(() => runPollCycle(tournamentId), THREE_MIN)
    } else if (nextMatch && msUntil(nextMatch.utcDate) <= THIRTY_MIN) {
      currentMode = 'pre_match'
      await fetchAndStoreLiveData(tournamentId)
    } else {
      currentMode = 'idle'
      // Back to 10-minute polling
      if (pollerInterval) clearInterval(pollerInterval)
      pollerInterval = setInterval(() => runPollCycle(tournamentId), TEN_MIN)
    }
  } catch (err) {
    console.error('Poll cycle error:', err)
  }
}

const fetchAndStoreLiveData = async (tournamentId) => {
  const data = await getLiveFixtures()
  if (!data?.response) return

  const batch = data.response.map(async (fixture) => {
    const matchRef = doc(
      db,
      'tournaments',
      tournamentId,
      'matches',
      String(fixture.fixture.id)
    )
    await setDoc(
      matchRef,
      {
        status: fixture.fixture.status.short,
        score: fixture.goals,
        elapsed: fixture.fixture.status.elapsed,
        events: fixture.events || [],
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  })

  await Promise.all(batch)
}
