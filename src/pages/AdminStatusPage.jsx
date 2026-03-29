import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { collection, getDocs, query, limit } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { useTournament } from '../contexts/TournamentContext'
import { syncTournamentMatches, syncTeamBadges } from '../services/firebase/tournaments'
import { ROUTES } from '../utils/constants'
import './AdminStatusPage.css'

const StatusRow = ({ label, status, note }) => {
  const icon = status === 'loading' ? '⏳' : status === 'ok' ? '🟢' : status === 'cors' ? '🟡' : '🔴'
  const text = status === 'loading' ? 'בודק...' : status === 'ok' ? 'תקין' : status === 'cors' ? 'לא נגיש מהדפדפן' : 'שגיאה'
  const cls = `status-badge status-${status === 'cors' ? 'loading' : status}`
  return (
    <div className="status-row">
      <span className="status-label">{label}</span>
      <span className={cls}>{icon} {text}</span>
      {note && <span className="status-note">{note}</span>}
    </div>
  )
}

const AdminStatusPage = () => {
  const { activeTournaments } = useTournament()

  const [fbStatus, setFbStatus] = useState('loading')
  const [espnStatus, setEspnStatus] = useState('loading')
  const [syncing, setSyncing] = useState(false)
  const [syncLog, setSyncLog] = useState([])

  useEffect(() => {
    const checkFirebase = async () => {
      try {
        await getDocs(query(collection(db, 'tournaments'), limit(1)))
        return 'ok'
      } catch {
        return 'error'
      }
    }

    const checkESPN = async () => {
      try {
        const r = await fetch(
          'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/scoreboard',
          { signal: AbortSignal.timeout(5000) }
        )
        return r.ok ? 'ok' : 'error'
      } catch (e) {
        // CORS or network error — ESPN blocks browser requests from external domains
        if (e?.name === 'TypeError' || e?.message?.includes('CORS') || e?.message?.includes('Failed to fetch') || e?.name === 'AbortError') {
          return 'cors'
        }
        return 'error'
      }
    }

    Promise.all([checkFirebase(), checkESPN()]).then(([fb, espn]) => {
      setFbStatus(fb)
      setEspnStatus(espn)
    })
  }, [])

  const handleSyncAll = async () => {
    setSyncing(true)
    const logs = []
    for (const t of activeTournaments) {
      try {
        await syncTournamentMatches(t.id)
        logs.push(`✅ ${t.name} — משחקים עודכנו`)
      } catch (e) {
        logs.push(`❌ ${t.name} — שגיאה: ${e.message}`)
      }
    }
    setSyncLog(logs)
    setSyncing(false)
    toast.success('סנכרון הושלם')
  }

  const handleSyncBadges = async () => {
    setSyncing(true)
    const logs = []
    for (const t of activeTournaments) {
      try {
        await syncTeamBadges(t.id)
        logs.push(`✅ ${t.name} — לוגואים עודכנו`)
      } catch (e) {
        logs.push(`❌ ${t.name} — שגיאה: ${e.message}`)
      }
    }
    setSyncLog(logs)
    setSyncing(false)
    toast.success('עדכון לוגואים הושלם')
  }

  return (
    <div className="admin-status-page">
      <Link to={ROUTES.ADMIN} className="back-link">← חזור לניהול</Link>
      <h2>📡 מצב מערכת</h2>

      {/* Status indicators */}
      <div className="card status-card">
        <h3>בדיקות חיבור</h3>
        <div className="status-rows">
          <StatusRow label="Firebase Firestore" status={fbStatus} />
          <StatusRow label="ESPN API" status={espnStatus} note={espnStatus === 'cors' ? '(חסום CORS מהדפדפן — תקין לשימוש צד-שרת)' : undefined} />
        </div>
      </div>

      {/* Sync actions */}
      <div className="card status-card">
        <h3>פעולות סנכרון</h3>
        <div className="status-actions">
          <button
            className="btn btn-primary"
            onClick={handleSyncAll}
            disabled={syncing || activeTournaments.length === 0}
          >
            {syncing ? 'מסנכרן...' : '🔄 סנכרן משחקים'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSyncBadges}
            disabled={syncing || activeTournaments.length === 0}
          >
            {syncing ? 'מסנכרן...' : '🖼️ עדכן לוגואים'}
          </button>
        </div>
        {activeTournaments.length === 0 && (
          <p className="text-muted mt-2" style={{ fontSize: '0.85rem' }}>אין טורנירים פעילים לסנכרן</p>
        )}

        {/* Sync log */}
        {syncLog.length > 0 && (
          <div className="status-log">
            {syncLog.map((line, i) => (
              <div key={i} className="status-log-line">{line}</div>
            ))}
          </div>
        )}
      </div>

      {/* Active tournaments info */}
      {activeTournaments.length > 0 && (
        <div className="card status-card">
          <h3>טורנירים פעילים</h3>
          <ul className="status-tourn-list">
            {activeTournaments.map(t => (
              <li key={t.id} className="status-tourn-item">
                {t.emblem && <img src={t.emblem} alt="" className="status-tourn-emblem" />}
                <span>{t.name}</span>
                {t.updatedAt && (
                  <span className="text-muted" style={{ fontSize: '0.8rem', marginRight: 'auto' }}>
                    עדכון: {new Date(t.updatedAt.seconds * 1000).toLocaleString('he-IL')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default AdminStatusPage
