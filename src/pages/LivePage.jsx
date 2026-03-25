import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { useTournament } from '../contexts/TournamentContext'
import './LivePage.css'

const LivePage = () => {
  const { activeTournament } = useTournament()
  const [leaderboard, setLeaderboard] = useState([])
  const [matches, setMatches] = useState([])

  // Top 10 leaderboard — updates every 60 seconds via Firestore real-time
  useEffect(() => {
    if (!activeTournament?.id) return
    const q = query(
      collection(db, 'tournaments', activeTournament.id, 'leaderboard'),
      orderBy('totalPoints', 'desc'),
      limit(10)
    )
    const unsub = onSnapshot(q, (snap) => {
      setLeaderboard(snap.docs.map((d, i) => ({ rank: i + 1, id: d.id, ...d.data() })))
    })
    return unsub
  }, [activeTournament?.id])

  // Live & today's matches
  useEffect(() => {
    if (!activeTournament?.id) return
    const today = new Date().toISOString().slice(0, 10)
    const q = query(
      collection(db, 'tournaments', activeTournament.id, 'matches'),
      orderBy('utcDate', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const todayMatches = all.filter((m) => m.utcDate?.startsWith(today))
      setMatches(todayMatches)
    })
    return unsub
  }, [activeTournament?.id])

  const liveMatches = matches.filter((m) => ['IN_PLAY', 'HALFTIME', 'PAUSED'].includes(m.status))
  const finishedToday = matches.filter((m) => m.status === 'FINISHED')
  const upcomingToday = matches.filter((m) => ['TIMED', 'SCHEDULED'].includes(m.status))

  return (
    <div className="live-page">
      {/* Header */}
      <header className="live-header">
        <div className="live-logo">🏆</div>
        <div>
          <h1 className="live-title">ניחושי ספורט</h1>
          {activeTournament && (
            <p className="live-tournament">{activeTournament.name}</p>
          )}
        </div>
      </header>

      <div className="live-grid">
        {/* Leaderboard column */}
        <section className="live-section">
          <h2 className="live-section-title">🥇 מובילים</h2>
          <ul className="live-leaderboard">
            {leaderboard.length === 0 && (
              <li className="live-empty">אין נתונים עדיין</li>
            )}
            {leaderboard.map((entry) => (
              <li key={entry.id} className={`live-lb-row rank-${entry.rank}`}>
                <span className="live-rank">{entry.rank}</span>
                <img
                  src={entry.photoURL || '/default-avatar.png'}
                  alt={entry.displayName}
                  className="live-avatar"
                />
                <span className="live-name">{entry.displayName}</span>
                <span className="live-points">{entry.totalPoints ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Matches column */}
        <section className="live-section">
          {liveMatches.length > 0 && (
            <>
              <h2 className="live-section-title">🔴 משחקים חיים</h2>
              {liveMatches.map((m) => (
                <MatchCard key={m.id} match={m} type="live" />
              ))}
            </>
          )}

          {finishedToday.length > 0 && (
            <>
              <h2 className="live-section-title mt-2">✅ הסתיימו היום</h2>
              {finishedToday.map((m) => (
                <MatchCard key={m.id} match={m} type="finished" />
              ))}
            </>
          )}

          {upcomingToday.length > 0 && (
            <>
              <h2 className="live-section-title mt-2">🕐 הבא</h2>
              <MatchCard match={upcomingToday[0]} type="upcoming" />
            </>
          )}

          {matches.length === 0 && (
            <p className="live-empty">אין משחקים היום</p>
          )}
        </section>
      </div>
    </div>
  )
}

const MatchCard = ({ match, type }) => {
  const time = match.utcDate
    ? new Date(match.utcDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className={`live-match-card live-match-${type}`}>
      <div className="live-match-teams">
        <span className="live-team">
          {match.homeTeam?.crest && (
            <img src={match.homeTeam.crest} alt="" className="live-team-logo" />
          )}
          {match.homeTeam?.name || 'בית'}
        </span>
        <span className="live-score">
          {type === 'live' || type === 'finished'
            ? `${match.score?.home ?? 0} : ${match.score?.away ?? 0}`
            : time}
        </span>
        <span className="live-team away">
          {match.awayTeam?.name || 'אורח'}
          {match.awayTeam?.crest && (
            <img src={match.awayTeam.crest} alt="" className="live-team-logo" />
          )}
        </span>
      </div>
      {type === 'live' && match.elapsed && (
        <span className="live-elapsed">{match.elapsed}′</span>
      )}
    </div>
  )
}

export default LivePage
