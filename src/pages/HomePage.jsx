import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { getMatchBet } from '../services/firebase/bets'
import './HomePage.css'

const MatchCard = ({ match, matchBetsData }) => {
  const myBet = matchBetsData?.bets?.[match.id]

  let type = 'upcoming'
  if (['live', 'halftime'].includes(match.status)) type = 'live'
  else if (match.status === 'finished') type = 'finished'

  let time = ''
  if (match.utcDate) {
    try {
      const d = new Date(match.utcDate)
      time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch {
      time = ''
    }
  }

  const showScore = ['live', 'halftime', 'finished'].includes(match.status)

  return (
    <div className={`home-match-card home-match-${type}`}>
      <div className="home-match-teams">
        <span className="home-team">
          {match.homeTeam?.badge && (
            <img src={match.homeTeam.badge} alt="" className="home-team-logo" />
          )}
          {match.homeTeam?.name || 'בית'}
        </span>
        <span className="home-match-score">
          {showScore
            ? `${match.score?.home ?? 0} : ${match.score?.away ?? 0}`
            : time}
        </span>
        <span className="home-team away">
          {match.awayTeam?.name || 'אורח'}
          {match.awayTeam?.badge && (
            <img src={match.awayTeam.badge} alt="" className="home-team-logo" />
          )}
        </span>
      </div>
      {myBet && (
        <div className="home-match-bet">ניחוש שלי: {myBet.home} : {myBet.away}</div>
      )}
      {type === 'live' && match.elapsed && (
        <span className="home-match-elapsed">{match.elapsed}′</span>
      )}
    </div>
  )
}

const HomePage = () => {
  const { userProfile } = useAuth()
  const { activeTournaments, loading: tLoading } = useTournament()

  const [selectedId, setSelectedId] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [todayMatches, setTodayMatches] = useState([])
  const [matchBetsData, setMatchBetsData] = useState(null)

  // Default tournament selection
  useEffect(() => {
    if (activeTournaments.length > 0 && !selectedId) {
      setSelectedId(activeTournaments[0].id)
    }
  }, [activeTournaments])

  const selectedTournament =
    activeTournaments.find(t => t.id === selectedId) || activeTournaments[0] || null

  // Leaderboard real-time listener
  useEffect(() => {
    if (!selectedTournament?.id) return
    const q = query(
      collection(db, 'tournaments', selectedTournament.id, 'leaderboard'),
      orderBy('totalPoints', 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setLeaderboard(snap.docs.map((d, i) => ({ rank: i + 1, id: d.id, ...d.data() })))
    })
    return () => {
      setLeaderboard([])
      unsub()
    }
  }, [selectedTournament?.id])

  // Today's matches real-time listener
  useEffect(() => {
    if (!selectedTournament?.id) return
    const today = new Date().toISOString().slice(0, 10)
    const q = query(
      collection(db, 'tournaments', selectedTournament.id, 'matches'),
      orderBy('utcDate', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTodayMatches(all.filter(m => m.utcDate?.startsWith(today)))
    })
    return () => {
      setTodayMatches([])
      unsub()
    }
  }, [selectedTournament?.id])

  // My match bets (one-time fetch per tournament)
  useEffect(() => {
    if (!selectedTournament?.id || !userProfile?.id) return
    setMatchBetsData(null)
    getMatchBet(userProfile.id, selectedTournament.id).then(data => setMatchBetsData(data))
  }, [selectedTournament?.id, userProfile?.id])

  if (tLoading) return <LoadingSpinner />

  const firstName = userProfile?.displayName?.split(' ')[0] || 'חבר'

  const myEntry = leaderboard.find(e => e.id === userProfile?.id)
  const myRank = myEntry?.rank ?? null
  const myPoints = myEntry?.totalPoints ?? 0
  const totalParticipants = leaderboard.length

  const liveMatches = todayMatches.filter(m => ['live', 'halftime'].includes(m.status))
  const finishedToday = todayMatches.filter(m => m.status === 'finished')
  const upcomingToday = todayMatches.filter(m => ['scheduled', 'timed'].includes(m.status))

  return (
    <div className="home-page">
      {/* Greeting */}
      <div className="home-header">
        <h1 className="home-greeting">שלום, {firstName} 👋</h1>
      </div>

      {/* Tournament tabs (only if >1) */}
      {activeTournaments.length > 1 && (
        <div className="home-tabs">
          {activeTournaments.map(t => (
            <button
              key={t.id}
              className={`home-tab${t.id === selectedId ? ' home-tab-active' : ''}`}
              onClick={() => setSelectedId(t.id)}
            >
              {t.emblem && <img src={t.emblem} alt="" className="home-tab-emblem" />}
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* No tournament case */}
      {!selectedTournament ? (
        <div className="card home-no-tournament">
          <p>אין טורניר פעיל כרגע</p>
          <p className="text-muted">המנהל יפתח טורניר בקרוב</p>
        </div>
      ) : (
        <div className="home-content">
          <div className="home-top-grid">
            {/* Rank card */}
            <div className="card home-rank-card">
              {myRank !== null ? (
                <>
                  <div className="home-rank-number">#{myRank}</div>
                  <div className="home-rank-label">מתוך {totalParticipants} משתתפים</div>
                  <div className="home-rank-points">{myPoints} נקודות</div>
                </>
              ) : (
                <div className="home-rank-empty">טרם נרשמת לטבלה</div>
              )}
            </div>

            {/* Today's matches */}
            <div className="home-matches-col">
              <h3 className="home-section-title">משחקי היום</h3>

              {liveMatches.length > 0 && (
                <>
                  <p className="home-match-group-label">🔴 חיים</p>
                  {liveMatches.map(m => (
                    <MatchCard key={m.id} match={m} matchBetsData={matchBetsData} />
                  ))}
                </>
              )}

              {finishedToday.length > 0 && (
                <>
                  <p className="home-match-group-label">✅ הסתיימו</p>
                  {finishedToday.map(m => (
                    <MatchCard key={m.id} match={m} matchBetsData={matchBetsData} />
                  ))}
                </>
              )}

              {upcomingToday.length > 0 && (
                <>
                  <p className="home-match-group-label">🕐 הבא</p>
                  {upcomingToday.map(m => (
                    <MatchCard key={m.id} match={m} matchBetsData={matchBetsData} />
                  ))}
                </>
              )}

              {todayMatches.length === 0 && (
                <p className="text-muted">אין משחקים היום</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage
