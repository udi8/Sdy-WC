import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import { getAllMatchBets, scoreMatchBet } from '../services/firebase/bets'
import { ROUTES } from '../utils/constants'
import './ArchiveViewPage.css'

const formatDate = (d) => {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch { return '' }
}

const ArchiveViewPage = () => {
  const { tournamentId } = useParams()
  const { userProfile } = useAuth()
  const { tournaments } = useTournament()
  const tournament = tournaments.find(t => t.id === tournamentId) || null

  const [activeTab, setActiveTab] = useState('leaderboard')
  const [leaderboard, setLeaderboard] = useState([])
  const [matches, setMatches] = useState([])
  const [allMatchBets, setAllMatchBets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tournamentId) return
    setLoading(true)
    Promise.all([
      getDocs(query(collection(db, 'tournaments', tournamentId, 'leaderboard'), orderBy('totalPoints', 'desc'))),
      getDocs(query(collection(db, 'tournaments', tournamentId, 'matches'), orderBy('utcDate', 'asc'))),
      getAllMatchBets(tournamentId),
    ]).then(([lbSnap, matchSnap, bets]) => {
      setLeaderboard(lbSnap.docs.map((d, i) => ({ rank: i + 1, id: d.id, ...d.data() })))
      setMatches(matchSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setAllMatchBets(bets)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [tournamentId])

  const myBetsDoc = allMatchBets.find(b => b.userId === userProfile?.id)
  const finishedMatches = matches.filter(m => m.status === 'finished')
    .sort((a, b) => new Date(b.utcDate || b.date) - new Date(a.utcDate || a.date))

  return (
    <div className="archive-view-page">
      <Link to={ROUTES.ARCHIVE} className="back-link">← ארכיון</Link>
      <div className="archive-view-header">
        {tournament?.emblem && <img src={tournament.emblem} alt="" className="archive-view-emblem" />}
        <div>
          <h2>{tournament?.name || '...'}</h2>
          <span className="text-muted">עונה: {tournament?.season}</span>
        </div>
      </div>

      <div className="archive-tabs">
        <button className={`archive-tab${activeTab === 'leaderboard' ? ' archive-tab-active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
          🏆 טבלת מובילים
        </button>
        <button className={`archive-tab${activeTab === 'mybets' ? ' archive-tab-active' : ''}`} onClick={() => setActiveTab('mybets')}>
          📋 הניחושים שלי
        </button>
        <button className={`archive-tab${activeTab === 'matches' ? ' archive-tab-active' : ''}`} onClick={() => setActiveTab('matches')}>
          ⚽ כל המשחקים
        </button>
      </div>

      {loading ? (
        <p className="text-muted">טוען...</p>
      ) : (
        <>
          {/* Leaderboard tab */}
          {activeTab === 'leaderboard' && (
            <div className="archive-lb-section">
              {leaderboard.length === 0 ? (
                <p className="text-muted">אין נתוני טבלה</p>
              ) : (
                <table className="archive-lb-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>שחקן</th>
                      <th>נק' מחזורים</th>
                      <th>נק' סטטי</th>
                      <th>סה"כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map(e => (
                      <tr key={e.id} className={e.id === userProfile?.id ? 'archive-lb-me' : ''}>
                        <td>{e.rank}</td>
                        <td>{e.displayName || e.id}</td>
                        <td>{e.matchPoints ?? 0}</td>
                        <td>{e.staticPoints ?? 0}</td>
                        <td><strong>{e.totalPoints ?? 0}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* My bets tab */}
          {activeTab === 'mybets' && (
            <div className="archive-mybets-section">
              {finishedMatches.length === 0 ? (
                <p className="text-muted">אין משחקים שהסתיימו</p>
              ) : (
                <table className="archive-matches-table">
                  <thead>
                    <tr>
                      <th>תאריך</th>
                      <th>בית</th>
                      <th>תוצאה</th>
                      <th>אורח</th>
                      <th>ניחוש</th>
                      <th>נק'</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finishedMatches.map(m => {
                      const bet = myBetsDoc?.bets?.[m.id]
                      const pts = bet ? scoreMatchBet(bet, { home: m.score?.home ?? 0, away: m.score?.away ?? 0 }) : null
                      return (
                        <tr key={m.id} className={pts > 0 ? 'archive-row-scored' : ''}>
                          <td className="archive-date">{formatDate(m.utcDate || m.date)}</td>
                          <td>{m.homeTeam?.name || '—'}</td>
                          <td className="archive-score">{m.score?.home}:{m.score?.away}</td>
                          <td>{m.awayTeam?.name || '—'}</td>
                          <td className="archive-bet">{bet ? `${bet.home}:${bet.away}` : '—'}</td>
                          <td className="archive-pts">
                            {pts !== null ? (
                              pts > 0 ? <span className="pts-positive">{pts}</span> : <span className="pts-zero">0</span>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* All matches tab */}
          {activeTab === 'matches' && (
            <div className="archive-allmatches-section">
              {finishedMatches.length === 0 ? (
                <p className="text-muted">אין משחקים שהסתיימו</p>
              ) : (
                <table className="archive-matches-table">
                  <thead>
                    <tr>
                      <th>תאריך</th>
                      <th>בית</th>
                      <th>תוצאה</th>
                      <th>אורח</th>
                      <th>שלב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finishedMatches.map(m => (
                      <tr key={m.id}>
                        <td className="archive-date">{formatDate(m.utcDate || m.date)}</td>
                        <td>{m.homeTeam?.name || '—'}</td>
                        <td className="archive-score">{m.score?.home}:{m.score?.away}</td>
                        <td>{m.awayTeam?.name || '—'}</td>
                        <td className="archive-stage">{m.stage || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ArchiveViewPage
