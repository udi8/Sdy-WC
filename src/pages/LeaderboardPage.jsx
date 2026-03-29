import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import { useNavigate } from 'react-router-dom'
import './LeaderboardPage.css'

const LeaderboardPage = () => {
  const { userProfile } = useAuth()
  const { activeTournaments, loading: tLoading } = useTournament()
  const navigate = useNavigate()

  const [selectedId, setSelectedId] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [search, setSearch] = useState('')

  // Default to first tournament
  useEffect(() => {
    if (activeTournaments.length > 0 && !selectedId)
      setSelectedId(activeTournaments[0].id)
  }, [activeTournaments])

  const selectedTournament = activeTournaments.find(t => t.id === selectedId) || activeTournaments[0] || null

  // Real-time leaderboard listener
  useEffect(() => {
    if (!selectedTournament?.id) return
    const q = query(
      collection(db, 'tournaments', selectedTournament.id, 'leaderboard'),
      orderBy('totalPoints', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setLeaderboard(snap.docs.map((d, i) => ({ rank: i + 1, id: d.id, ...d.data() })))
    })
    return () => { setLeaderboard([]); unsub() }
  }, [selectedTournament?.id])

  const filtered = search.trim()
    ? leaderboard.filter(e => e.displayName?.toLowerCase().includes(search.toLowerCase()))
    : leaderboard

  const myEntry = leaderboard.find(e => e.id === userProfile?.id)

  if (tLoading) return <div className="card"><p className="text-muted">טוען...</p></div>

  return (
    <div className="leaderboard-page">
      <button className="back-link" onClick={() => navigate(-1)}>← חזור</button>
      <h2>📊 טבלת מובילים</h2>

      {/* Tournament tabs */}
      {activeTournaments.length > 1 && (
        <div className="lb-tabs">
          {activeTournaments.map(t => (
            <button
              key={t.id}
              className={`lb-tab${t.id === selectedId ? ' lb-tab-active' : ''}`}
              onClick={() => setSelectedId(t.id)}
            >
              {t.emblem && <img src={t.emblem} alt="" className="lb-tab-emblem" />}
              {t.name}
            </button>
          ))}
        </div>
      )}

      {selectedTournament && (
        <p className="text-muted lb-tournament-name">
          {selectedTournament.name} · עונה {selectedTournament.season}
        </p>
      )}

      {/* My position banner */}
      {myEntry && (
        <div className="lb-my-position card">
          <span className="lb-my-rank">#{myEntry.rank}</span>
          <span className="lb-my-label">המיקום שלי</span>
          <span className="lb-my-points">{myEntry.totalPoints ?? 0} נק'</span>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        className="form-control lb-search"
        placeholder="חיפוש שם..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Leaderboard table */}
      <div className="card lb-table-card">
        {leaderboard.length === 0 ? (
          <p className="text-muted lb-empty">אין נתונים עדיין — הניחושים ייקלטו לאחר תחילת המשחקים</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted lb-empty">לא נמצאו תוצאות לחיפוש</p>
        ) : (
          <table className="lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>משתתף</th>
                <th>נקודות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => (
                <tr
                  key={entry.id}
                  className={`lb-row${entry.id === userProfile?.id ? ' lb-row-me' : ''}${entry.rank <= 3 ? ` lb-row-top${entry.rank}` : ''}`}
                >
                  <td className="lb-rank">
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                  </td>
                  <td className="lb-name">
                    <img
                      src={entry.photoURL || ''}
                      alt={entry.displayName}
                      className="lb-avatar"
                      onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.displayName || '?')}&background=1a3a5c&color=fff` }}
                    />
                    {entry.displayName || '—'}
                    {entry.id === userProfile?.id && <span className="lb-me-badge">אתה</span>}
                  </td>
                  <td className="lb-points">{entry.totalPoints ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default LeaderboardPage
