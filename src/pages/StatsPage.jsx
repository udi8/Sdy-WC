import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { getAllMatchBets, getAllStaticBets, scoreMatchBet } from '../services/firebase/bets'
import './StatsPage.css'

const ProgressBar = ({ value, max, color = 'var(--color-primary)' }) => (
  <div className="stats-progress-bg">
    <div
      className="stats-progress-fill"
      style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%`, background: color }}
    />
  </div>
)

const StatsPage = () => {
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const { activeTournaments, loading: tLoading } = useTournament()

  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(false)

  // Personal
  const [totalBets, setTotalBets] = useState(0)
  const [exactBets, setExactBets] = useState(0)
  const [directionBets, setDirectionBets] = useState(0)
  const [matchPoints, setMatchPoints] = useState(0)
  const [staticPoints, setStaticPoints] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)

  // General
  const [topChampion, setTopChampion] = useState(null)
  const [topScorer, setTopScorer] = useState(null)
  const [bestMatch, setBestMatch] = useState(null)
  const [allStaticBets, setAllStaticBets] = useState([])
  const [allMatchBets, setAllMatchBets] = useState([])

  useEffect(() => {
    if (activeTournaments.length > 0 && !selectedId) setSelectedId(activeTournaments[0].id)
  }, [activeTournaments])

  const selectedTournament = activeTournaments.find(t => t.id === selectedId) || activeTournaments[0] || null

  useEffect(() => {
    if (!selectedTournament?.id || !userProfile?.id) return
    setLoading(true)
    ;(async () => {
      try {
        const [matchSnap, lbSnap, allMB, allSB] = await Promise.all([
          getDocs(collection(db, 'tournaments', selectedTournament.id, 'matches')),
          getDoc(doc(db, 'tournaments', selectedTournament.id, 'leaderboard', userProfile.id)),
          getAllMatchBets(selectedTournament.id),
          getAllStaticBets(selectedTournament.id),
        ])

        const finished = matchSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.status === 'finished')
        const myLb = lbSnap.exists() ? lbSnap.data() : null
        const myBetsDoc = allMB.find(b => b.userId === userProfile.id)

        // Personal stats
        let tb = 0, eb = 0, db2 = 0
        for (const m of finished) {
          const bet = myBetsDoc?.bets?.[m.id]
          if (!bet) continue
          tb++
          const pts = scoreMatchBet(bet, { home: m.score?.home ?? 0, away: m.score?.away ?? 0 })
          if (pts === 7) { eb++; db2++ }
          else if (pts >= 3) db2++
        }
        setTotalBets(tb); setExactBets(eb); setDirectionBets(db2)
        setMatchPoints(myLb?.matchPoints ?? 0)
        setStaticPoints(myLb?.staticPoints ?? 0)
        setTotalPoints(myLb?.totalPoints ?? 0)

        // General stats
        setAllStaticBets(allSB); setAllMatchBets(allMB)

        const champ = {}
        const scorer = {}
        for (const b of allSB) {
          if (b.champion) champ[b.champion] = (champ[b.champion] || 0) + 1
          if (b.topScorer) scorer[b.topScorer] = (scorer[b.topScorer] || 0) + 1
        }
        const topC = Object.entries(champ).sort((a, b) => b[1] - a[1])[0] || null
        const topS = Object.entries(scorer).sort((a, b) => b[1] - a[1])[0] || null
        setTopChampion(topC); setTopScorer(topS)

        const exactCounts = {}
        for (const m of finished) {
          let count = 0
          for (const ub of allMB) {
            const b = ub.bets?.[m.id]
            if (b && scoreMatchBet(b, { home: m.score?.home ?? 0, away: m.score?.away ?? 0 }) === 7) count++
          }
          if (count > 0) exactCounts[m.id] = { count, match: m }
        }
        const best = Object.values(exactCounts).sort((a, b) => b.count - a.count)[0] || null
        setBestMatch(best)
      } finally {
        setLoading(false)
      }
    })()
  }, [selectedTournament?.id, userProfile?.id])

  const exactPct = totalBets > 0 ? Math.round((exactBets / totalBets) * 100) : 0
  const directionPct = totalBets > 0 ? Math.round((directionBets / totalBets) * 100) : 0

  return (
    <div className="stats-page">
      <button className="back-link" onClick={() => navigate(-1)}>← חזור</button>
      <h2>📈 סטטיסטיקות</h2>

      {/* Tournament tabs */}
      {activeTournaments.length > 1 && (
        <div className="stats-tabs">
          {activeTournaments.map(t => (
            <button
              key={t.id}
              className={`stats-tab${t.id === selectedId ? ' stats-tab-active' : ''}`}
              onClick={() => setSelectedId(t.id)}
            >
              {t.emblem && <img src={t.emblem} alt="" className="stats-tab-emblem" />}
              {t.name}
            </button>
          ))}
        </div>
      )}

      {tLoading || loading ? (
        <p className="text-muted">טוען...</p>
      ) : !selectedTournament ? (
        <p className="text-muted">אין טורניר פעיל</p>
      ) : (
        <>
          {/* Personal section */}
          <section className="stats-section">
            <h3 className="stats-section-title">האישי שלי</h3>
            <div className="stats-cards-row">
              <div className="stats-card">
                <div className="stats-card-value">{totalBets}</div>
                <div className="stats-card-label">סה"כ ניחושים</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value">{exactBets}</div>
                <div className="stats-card-label">מדויקים ({exactPct}%)</div>
              </div>
              <div className="stats-card">
                <div className="stats-card-value">{directionBets}</div>
                <div className="stats-card-label">כיוון נכון ({directionPct}%)</div>
              </div>
              <div className="stats-card stats-card-highlight">
                <div className="stats-card-value">{totalPoints}</div>
                <div className="stats-card-label">נקודות סה"כ</div>
              </div>
            </div>

            <div className="stats-breakdown">
              <div className="stats-breakdown-row">
                <span className="stats-breakdown-label">⚽ ניחושי מחזורים</span>
                <ProgressBar value={matchPoints} max={Math.max(matchPoints + staticPoints, 1)} color="var(--color-primary)" />
                <span className="stats-breakdown-pts">{matchPoints} נק'</span>
              </div>
              <div className="stats-breakdown-row">
                <span className="stats-breakdown-label">📋 ניחושים סטטיים</span>
                <ProgressBar value={staticPoints} max={Math.max(matchPoints + staticPoints, 1)} color="var(--color-secondary)" />
                <span className="stats-breakdown-pts">{staticPoints} נק'</span>
              </div>
            </div>
          </section>

          {/* General section */}
          <section className="stats-section">
            <h3 className="stats-section-title">סטטיסטיקות טורניר</h3>
            {allStaticBets.length === 0 && allMatchBets.length === 0 ? (
              <p className="text-muted">אין מספיק נתונים עדיין</p>
            ) : (
              <ul className="stats-general-list">
                {topChampion && (
                  <li>🏆 הניחוש הפופולרי לאלוף: <strong>{topChampion[0]}</strong> ({Math.round(topChampion[1] / allStaticBets.length * 100)}%)</li>
                )}
                {topScorer && (
                  <li>⚽ מלך שערים פופולרי: <strong>{topScorer[0]}</strong> ({Math.round(topScorer[1] / allStaticBets.length * 100)}%)</li>
                )}
                {bestMatch && (
                  <li>🎯 הכי הרבה ניחושים מדויקים: <strong>{bestMatch.match.homeTeam?.name} {bestMatch.match.score?.home}:{bestMatch.match.score?.away} {bestMatch.match.awayTeam?.name}</strong> ({bestMatch.count} ניחושים)</li>
                )}
                {!topChampion && !topScorer && !bestMatch && (
                  <p className="text-muted">אין מספיק נתונים עדיין</p>
                )}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default StatsPage
