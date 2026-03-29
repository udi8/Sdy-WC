import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import {
  getBetLockHours,
  saveBetLockHours,
  getAllMatchBets,
  getAllStaticBets,
  submitMatchResult,
  scoreMatchBet,
} from '../services/firebase/bets'
import { useTournament } from '../contexts/TournamentContext'
import { toast } from 'react-toastify'
import { ROUTES } from '../utils/constants'
import './AdminBetsPage.css'

// ── Helpers ────────────────────────────────────────────────────────────────────

const MATCH_STATUS_LABELS = {
  finished:  { label: 'הסתיים',     cls: 'status-finished'  },
  in_play:   { label: 'בשידור חי', cls: 'status-in-play'   },
  scheduled: { label: 'מתוכנן',     cls: 'status-scheduled' },
  timed:     { label: 'מתוכנן',     cls: 'status-scheduled' },
  postponed: { label: 'נדחה',       cls: 'status-scheduled' },
  cancelled: { label: 'בוטל',       cls: 'status-scheduled' },
}

const formatMatchDate = (utcDate) => {
  if (!utcDate) return ''
  try {
    return new Date(utcDate).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return utcDate
  }
}

// ── Sub-component: Lock Tab ────────────────────────────────────────────────────

const LockTab = ({ lockHours, setLockHours, savingLock, setSavingLock }) => {
  const handleSave = async () => {
    if (lockHours === '' || isNaN(Number(lockHours)) || Number(lockHours) < 0) {
      toast.error('יש להזין מספר שעות תקין')
      return
    }
    setSavingLock(true)
    try {
      await saveBetLockHours(lockHours)
      toast.success(`הגדרת הנעילה עודכנה: ${lockHours} שעות`)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה בשמירה, נסה שוב')
    } finally {
      setSavingLock(false)
    }
  }

  return (
    <div className="card lock-tab-card">
      <h3>🔒 הגדרת נעילת ניחושים</h3>
      <div className="lock-tab-row">
        <span className="lock-tab-label">נעל ניחושים</span>
        <input
          type="number"
          className="form-control lock-hours-input"
          value={lockHours}
          min={0}
          max={168}
          onChange={(e) => setLockHours(Number(e.target.value))}
        />
        <span className="lock-tab-label">שעות לפני תחילת המשחק</span>
      </div>
      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={savingLock}
      >
        {savingLock ? 'שומר...' : '💾 שמור הגדרה'}
      </button>
      <p className="lock-tab-note">
        כאשר נותרות פחות מ-{lockHours} שעות למשחק, הניחושים ננעלים אוטומטית
      </p>
    </div>
  )
}

// ── Sub-component: Static Bets Tab ─────────────────────────────────────────────

const STATIC_BET_COLUMNS = [
  { key: 'champion',  label: 'אלוף'       },
  { key: 'runnerUp',  label: 'גמר'        },
  { key: 'topScorer', label: 'מלך שערים' },
  { key: 'mvp',       label: 'MVP'        },
  { key: 'darkHorse', label: 'סוס שחור'  },
]

const StaticTab = ({ staticBets, users }) => {
  const getUserDisplayName = (userId) =>
    users.find((u) => u.id === userId)?.displayName || userId

  if (staticBets.length === 0) {
    return (
      <div className="static-tab-section">
        <p className="text-muted">אין ניחושים סטטיים עדיין</p>
      </div>
    )
  }

  return (
    <div className="static-tab-section">
      <h3>📋 ניחושים סטטיים ({staticBets.length})</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-bets-table">
          <thead>
            <tr>
              <th>#</th>
              <th>משתמש</th>
              {STATIC_BET_COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staticBets.map((bet, idx) => (
              <tr key={bet.userId || idx}>
                <td>{idx + 1}</td>
                <td>{getUserDisplayName(bet.userId)}</td>
                {STATIC_BET_COLUMNS.map((col) => (
                  <td key={col.key}>{bet[col.key] || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Sub-component: Rounds Tab ──────────────────────────────────────────────────

const RoundsTab = ({
  matches,
  allMatchBets,
  users,
  selectedMatchId,
  setSelectedMatchId,
  homeScore,
  setHomeScore,
  awayScore,
  setAwayScore,
  submitting,
  setSubmitting,
  selectedTournId,
}) => {
  const getUserDisplayName = (userId) =>
    users.find((u) => u.id === userId)?.displayName || userId

  const selectedMatch = matches.find((m) => m.id === selectedMatchId)

  const handleSubmitResult = async () => {
    if (!selectedMatchId) { toast.error('יש לבחור משחק'); return }
    if (homeScore === '' || awayScore === '') { toast.error('יש להזין תוצאה'); return }
    if (isNaN(Number(homeScore)) || isNaN(Number(awayScore))) {
      toast.error('יש להזין מספרים תקינים')
      return
    }
    setSubmitting(true)
    try {
      const count = await submitMatchResult(
        selectedTournId,
        selectedMatchId,
        Number(homeScore),
        Number(awayScore)
      )
      toast.success(`עודכן! ${count} ניחושים חושבו`)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה בשמירת התוצאה, נסה שוב')
    } finally {
      setSubmitting(false)
    }
  }

  // Build bets table — only users who placed a bet for this match
  const betRows = users
    .map((user) => {
      const userMatchBetDoc = allMatchBets.find((mb) => mb.userId === user.id)
      const bet = userMatchBetDoc?.bets?.[selectedMatchId] ?? null
      return { user, bet }
    })
    .filter(({ bet }) => bet !== null)

  const isFinished = selectedMatch?.status === 'finished'
  const matchResult =
    isFinished && selectedMatch?.score != null
      ? { home: selectedMatch.score.home, away: selectedMatch.score.away }
      : null

  const statusInfo = selectedMatch
    ? MATCH_STATUS_LABELS[selectedMatch.status] || { label: selectedMatch.status, cls: 'status-scheduled' }
    : null

  return (
    <div className="rounds-tab-section">
      <h3>⚽ ניחושי מחזורים</h3>

      {matches.length === 0 ? (
        <p className="text-muted">אין משחקים בטורניר זה</p>
      ) : (
        <>
          {/* Match selector */}
          <select
            className="form-control rounds-match-select"
            value={selectedMatchId}
            onChange={(e) => {
              setSelectedMatchId(e.target.value)
              setHomeScore('')
              setAwayScore('')
            }}
          >
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.homeTeam?.name} vs {m.awayTeam?.name} · {formatMatchDate(m.utcDate)}
              </option>
            ))}
          </select>

          {/* Status badge */}
          {statusInfo && (
            <span className={`rounds-status-badge ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
          )}

          {/* Existing score when finished */}
          {isFinished && matchResult && (
            <div className="rounds-existing-score">
              תוצאה: {matchResult.home}:{matchResult.away}
            </div>
          )}

          {/* Result entry */}
          <div className="rounds-result-label">הזן תוצאה סופית:</div>
          <div className="rounds-result-entry">
            <input
              type="number"
              className="form-control rounds-score-input"
              value={homeScore}
              min={0}
              placeholder="0"
              onChange={(e) => setHomeScore(e.target.value)}
            />
            <span className="rounds-colon">:</span>
            <input
              type="number"
              className="form-control rounds-score-input"
              value={awayScore}
              min={0}
              placeholder="0"
              onChange={(e) => setAwayScore(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={handleSubmitResult}
              disabled={submitting}
            >
              {submitting ? 'שומר...' : '✅ אשר תוצאה ועדכן ניקוד'}
            </button>
          </div>

          {/* Bets table */}
          <div className="rounds-bets-section">
            <h4>ניחושי משתמשים ({betRows.length})</h4>
            {betRows.length === 0 ? (
              <p className="text-muted">אין ניחושים למשחק זה</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-bets-table">
                  <thead>
                    <tr>
                      <th>משתמש</th>
                      <th>ניחוש</th>
                      <th>ניקוד</th>
                    </tr>
                  </thead>
                  <tbody>
                    {betRows.map(({ user, bet }) => {
                      const pts =
                        isFinished && matchResult
                          ? scoreMatchBet(bet, matchResult)
                          : null
                      return (
                        <tr key={user.id}>
                          <td>{getUserDisplayName(user.id)}</td>
                          <td>{bet ? `${bet.home}:${bet.away}` : '—'}</td>
                          <td>
                            {pts !== null ? (
                              pts > 0 ? (
                                <span className="score-pts">{pts} נק'</span>
                              ) : (
                                <span className="score-zero">0 נק'</span>
                              )
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

const AdminBetsPage = () => {
  const { activeTournaments, loading: tLoading } = useTournament()

  const [activeTab, setActiveTab] = useState('lock')
  const [selectedTournId, setSelectedTournId] = useState(null)

  // Tab 1
  const [lockHours, setLockHours] = useState(24)
  const [savingLock, setSavingLock] = useState(false)

  // Tab 2
  const [staticBets, setStaticBets] = useState([])
  const [users, setUsers] = useState([])

  // Tab 3
  const [matches, setMatches] = useState([])
  const [allMatchBets, setAllMatchBets] = useState([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [loading, setLoading] = useState(false)

  // Auto-select first active tournament
  useEffect(() => {
    if (activeTournaments.length > 0 && !selectedTournId) {
      setSelectedTournId(activeTournaments[0].id)
    }
  }, [activeTournaments]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load all data when selected tournament changes
  useEffect(() => {
    if (!selectedTournId) return
    setLoading(true)
    setSelectedMatchId('')

    Promise.all([
      getBetLockHours().then((h) => setLockHours(h)),
      getDocs(collection(db, 'users')).then((snap) =>
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      getAllStaticBets(selectedTournId).then(setStaticBets),
      getAllMatchBets(selectedTournId).then(setAllMatchBets),
      getDocs(
        query(
          collection(db, 'tournaments', selectedTournId, 'matches'),
          orderBy('utcDate', 'asc')
        )
      ).then((snap) => {
        const ms = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setMatches(ms)
        if (ms.length > 0) setSelectedMatchId(ms[0].id)
      }),
    ])
      .catch((err) => {
        console.error(err)
        toast.error('שגיאה בטעינת הנתונים')
      })
      .finally(() => setLoading(false))
  }, [selectedTournId])

  if (tLoading) {
    return (
      <div className="admin-bets-page">
        <Link to={ROUTES.ADMIN} className="back-link">← חזור לניהול</Link>
        <p className="text-muted">טוען טורנירים...</p>
      </div>
    )
  }

  if (activeTournaments.length === 0) {
    return (
      <div className="admin-bets-page">
        <Link to={ROUTES.ADMIN} className="back-link">← חזור לניהול</Link>
        <h2>🎯 ניהול הימורים</h2>
        <p className="text-muted mt-2">אין טורנירים פעילים כרגע</p>
      </div>
    )
  }

  return (
    <div className="admin-bets-page">
      <Link to={ROUTES.ADMIN} className="back-link">← חזור לניהול</Link>
      <h2>🎯 ניהול הימורים</h2>

      {/* Tournament selector — only when more than 1 active tournament */}
      {activeTournaments.length > 1 && (
        <select
          className="form-control admin-bets-tourn-select"
          value={selectedTournId || ''}
          onChange={(e) => setSelectedTournId(e.target.value)}
        >
          {activeTournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}

      {/* Tab bar */}
      <div className="admin-bets-tabs">
        <button
          className={`admin-bets-tab${activeTab === 'lock' ? ' active' : ''}`}
          onClick={() => setActiveTab('lock')}
        >
          🔒 הגדרת נעילה
        </button>
        <button
          className={`admin-bets-tab${activeTab === 'static' ? ' active' : ''}`}
          onClick={() => setActiveTab('static')}
        >
          📋 ניחושים סטטיים
        </button>
        <button
          className={`admin-bets-tab${activeTab === 'rounds' ? ' active' : ''}`}
          onClick={() => setActiveTab('rounds')}
        >
          ⚽ ניחושי מחזורים
        </button>
      </div>

      {loading ? (
        <p className="text-muted">טוען...</p>
      ) : (
        <>
          {activeTab === 'lock' && (
            <LockTab
              lockHours={lockHours}
              setLockHours={setLockHours}
              savingLock={savingLock}
              setSavingLock={setSavingLock}
            />
          )}

          {activeTab === 'static' && (
            <StaticTab
              staticBets={staticBets}
              users={users}
            />
          )}

          {activeTab === 'rounds' && (
            <RoundsTab
              matches={matches}
              allMatchBets={allMatchBets}
              users={users}
              selectedMatchId={selectedMatchId}
              setSelectedMatchId={setSelectedMatchId}
              homeScore={homeScore}
              setHomeScore={setHomeScore}
              awayScore={awayScore}
              setAwayScore={setAwayScore}
              submitting={submitting}
              setSubmitting={setSubmitting}
              selectedTournId={selectedTournId}
            />
          )}
        </>
      )}
    </div>
  )
}

export default AdminBetsPage
