import { collection, doc, writeBatch, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from './config'
import { getLeaguesBySport } from '../api/sportsDb'

// Sports to sync — covers the vast majority of TheSportsDB leagues
const SPORTS = [
  'Soccer', 'Basketball', 'American Football', 'Baseball',
  'Ice Hockey', 'Tennis', 'Rugby', 'Cricket', 'Handball',
  'Volleyball', 'Motorsport', 'Cycling', 'Golf',
]

/**
 * Fetch all leagues from TheSportsDB and store in Firestore leagues collection.
 * Runs once (or on demand via admin button). Returns total count saved.
 */
export const syncAllLeagues = async (onProgress) => {
  let total = 0

  for (const sport of SPORTS) {
    onProgress?.(`מייבא ליגות ${sport}...`)
    try {
      const data = await getLeaguesBySport(sport)
      const leagues = data.leagues || []
      if (leagues.length === 0) continue

      // Batch write — max 490 per batch
      let batch = writeBatch(db)
      let count = 0

      for (const l of leagues) {
        const ref = doc(db, 'leagues', String(l.idLeague))
        batch.set(ref, {
          id: String(l.idLeague),
          name: l.strLeague || '',
          alternate: l.strLeagueAlternate || '',
          sport: l.strSport || sport,
          country: l.strCountry || '',
          badge: l.strBadge || l.strLogo || '',
          updatedAt: Date.now(),
        }, { merge: true })
        count++
        if (count === 490) {
          await batch.commit()
          batch = writeBatch(db)
          count = 0
        }
      }
      if (count > 0) await batch.commit()
      total += leagues.length
    } catch {
      // Some sports may return errors — continue
    }
  }

  return total
}

export const getStoredLeagues = async () => {
  const snap = await getDocs(query(collection(db, 'leagues'), orderBy('name')))
  return snap.docs.map((d) => d.data())
}
