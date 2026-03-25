import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import {
  getCompetition,
  getCompetitionTeams,
  getCompetitionMatches,
  getCompetitionScorers,
} from '../api/footballData'

/**
 * Import a full tournament from football-data.org into Firebase.
 * Creates: tournaments/{id}, teams subcollection, players subcollection, matches subcollection.
 */
export const importTournament = async (competition) => {
  const tournamentId = String(competition.id)
  const tournamentRef = doc(db, 'tournaments', tournamentId)

  // 1. Save tournament doc
  await setDoc(tournamentRef, {
    id: tournamentId,
    name: competition.name,
    code: competition.code,
    emblem: competition.emblem || null,
    area: competition.area?.name || null,
    status: 'setup',
    currentMatchday: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  // 2. Fetch & save teams + players
  await importTeamsAndPlayers(tournamentId, competition.id)

  // 3. Fetch & save matches
  await importMatches(tournamentId, competition.id)

  return tournamentId
}

const importTeamsAndPlayers = async (tournamentId, competitionId) => {
  const data = await getCompetitionTeams(competitionId)
  const teams = data.teams || []

  // Firestore batches are limited to 500 ops — chunk if needed
  const teamBatch = writeBatch(db)

  for (const team of teams) {
    const teamRef = doc(db, 'tournaments', tournamentId, 'teams', String(team.id))
    teamBatch.set(teamRef, {
      id: String(team.id),
      name: team.name,
      shortName: team.shortName || team.name,
      tla: team.tla || null,
      crest: team.crest || null,
      venue: team.venue || null,
    })
  }

  await teamBatch.commit()

  // Save players per team (may exceed 500 — use separate batches)
  for (const team of teams) {
    if (!team.squad || team.squad.length === 0) continue

    let batch = writeBatch(db)
    let count = 0

    for (const player of team.squad) {
      const playerRef = doc(
        db,
        'tournaments',
        tournamentId,
        'players',
        String(player.id)
      )
      batch.set(playerRef, {
        id: String(player.id),
        name: player.name,
        position: player.position || null,
        nationality: player.nationality || null,
        teamId: String(team.id),
        teamName: team.name,
        teamCrest: team.crest || null,
      })
      count++

      if (count === 490) {
        await batch.commit()
        batch = writeBatch(db)
        count = 0
      }
    }

    if (count > 0) await batch.commit()
  }
}

const importMatches = async (tournamentId, competitionId) => {
  const data = await getCompetitionMatches(competitionId)
  const matches = data.matches || []

  let batch = writeBatch(db)
  let count = 0

  for (const match of matches) {
    const matchRef = doc(
      db,
      'tournaments',
      tournamentId,
      'matches',
      String(match.id)
    )
    batch.set(matchRef, {
      id: String(match.id),
      utcDate: match.utcDate,
      status: match.status,
      matchday: match.matchday || null,
      stage: match.stage || null,
      group: match.group || null,
      homeTeam: {
        id: String(match.homeTeam.id),
        name: match.homeTeam.name,
        crest: match.homeTeam.crest || null,
      },
      awayTeam: {
        id: String(match.awayTeam.id),
        name: match.awayTeam.name,
        crest: match.awayTeam.crest || null,
      },
      score: {
        home: match.score?.fullTime?.home ?? null,
        away: match.score?.fullTime?.away ?? null,
      },
      locked: false,
    })
    count++

    if (count === 490) {
      await batch.commit()
      batch = writeBatch(db)
      count = 0
    }
  }

  if (count > 0) await batch.commit()
}

export const activateTournament = (tournamentId) =>
  updateDoc(doc(db, 'tournaments', tournamentId), {
    status: 'active',
    updatedAt: serverTimestamp(),
  })

export const deactivateTournament = (tournamentId) =>
  updateDoc(doc(db, 'tournaments', tournamentId), {
    status: 'finished',
    updatedAt: serverTimestamp(),
  })
