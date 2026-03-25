import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { getLeague } from '../services/api/sportsDb'
import { syncAllLeagues, getStoredLeagues } from '../services/firebase/leagues'
import { importTournament, activateTournament, deactivateTournament } from '../services/firebase/tournaments'
import { toast } from 'react-toastify'
import './AdminTournamentPage.css'

const defaultSeason = () => {
  const y = new Date().getFullYear()
  return new Date().getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

const AdminTournamentPage = () => {
  const [allLeagues, setAllLeagues]   = useState([])
  const [loadingLeagues, setLoadingLeagues] = useState(true)
  const [syncing, setSyncing]         = useState(false)
  const [syncProgress, setSyncProgress] = useState('')
  const [search, setSearch]           = useState('')
  const [seasons, setSeasons]         = useState({})
  const [importingId, setImportingId] = useState(null)
  const [importProgress, setImportProgress] = useState('')
  const [tournaments, setTournaments] = useState([])

  // Load leagues from Firestore on mount
  useEffect(() => {
    getStoredLeagues()
      .then((leagues) => setAllLeagues(leagues))
      .catch(() => {})
      .finally(() => setLoadingLeagues(false))
  }, [])

  // Load existing tournaments
  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) =>
      setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])

  const handleSync = async () => {
    if (!window.confirm('לסנכרן את כל הליגות מ-TheSportsDB ל-Firebase?\nהפעולה לוקחת כ-30 שניות.')) return
    setSyncing(true)
    setSyncProgress('מתחיל סנכרון...')
    try {
      const total = await syncAllLeagues((msg) => setSyncProgress(msg))
      const leagues = await getStoredLeagues()
      setAllLeagues(leagues)
      setSyncProgress('')
      toast.success(`✅ סונכרנו ${total} ליגות בהצלחה!`)
    } catch (err) {
      toast.error('שגיאה בסנכרון: ' + err.message)
      setSyncProgress('')
    } finally {
      setSyncing(false)
    }
  }

  const term = search.trim().toLowerCase()
  const filtered = term.length < 2
    ? allLeagues
    : allLeagues.filter((l) =>
        l.name?.toLowerCase().includes(term) ||
        l.alternate?.toLowerCase().includes(term) ||
        l.country?.toLowerCase().includes(term) ||
        l.sport?.toLowerCase().includes(term)
      )

  const getSeason = (id) => seasons[id] ?? defaultSeason()
  const setSeason = (id, val) => setSeasons((p) => ({ ...p, [id]: val }))

  const handleImport = async (league) => {
    const season = getSeason(league.id)
    if (!season.trim()) { toast.error('יש להזין עונה'); return }
    if (!window.confirm(`לייבא "${league.name}" עונת ${season}?`)) return

    setImportingId(league.id)
    setImportProgress(`מייבא "${league.name}" עונת ${season}...`)
    try {
      // Fetch full league details from TheSportsDB for badge/country
      let fullLeague = { idLeague: league.id, strLeague: league.name,
        strLeagueAlternate: league.alternate, strSport: league.sport,
        strCountry: league.country, strBadge: league.badge }
      try {
        const data = await getLeague(league.id)
        if (data.leagues?.[0]) fullLeague = data.leagues[0]
      } catch { /* use cached data */ }

      await importTournament(fullLeague, season)
      setImportProgress('')
      toast.success(`✅ "${league.name}" יובא בהצלחה!`)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה בייבוא: ' + err.message)
      setImportProgress('')
    } finally {
      setImportingId(null)
    }
  }

  const handleActivate   = async (t) => {
    try { await activateTournament(t.id);   toast.success(`"${t.name}" הופעל!`) }
    catch (err) { toast.error(err.message) }
  }
  const handleDeactivate = async (t) => {
    try { await deactivateTournament(t.id); toast.success(`"${t.name}" סומן כסיום.`) }
    catch (err) { toast.error(err.message) }
  }

  const statusLabel = {
    setup:    { text: 'הכנה',   cls: 'badge-warning' },
    active:   { text: 'פעיל',   cls: 'badge-success' },
    finished: { text: 'הסתיים', cls: 'badge-muted'   },
  }

  return (
    <div className="admin-tournament-page">
      <h2>🏆 יצירת טורניר</h2>

      <div className="tournament-search card">
        {/* Header row: title + sync button */}
        <div className="search-header">
          <h3>בחר ליגה</h3>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleSync}
            disabled={syncing || !!importingId}
          >
            {syncing ? '⏳ מסנכרן...' : '🔄 סנכרן ליגות'}
          </button>
        </div>

        {/* Sync progress */}
        {syncProgress && (
          <div className="import-progress mb-1">
            <div className="import-spinner" />
            <span>{syncProgress}</span>
          </div>
        )}

        {allLeagues.length === 0 && !loadingLeagues && !syncing && (
          <div className="empty-leagues">
            <p>אין ליגות שמורות עדיין.</p>
            <p className="text-muted">לחץ על <strong>🔄 סנכרן ליגות</strong> כדי לטעון את כל הליגות מ-TheSportsDB.</p>
          </div>
        )}

        {loadingLeagues && (
          <p className="text-muted mt-1">טוען ליגות שמורות...</p>
        )}

        {allLeagues.length > 0 && (
          <>
            <input
              type="text"
              className="form-control mt-1"
              placeholder={`חפש מתוך ${allLeagues.length} ליגות — World Cup, Champions League, ליגת העל...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!!importingId}
              autoFocus
            />
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
              {term.length < 2
                ? `הצג הכל (${allLeagues.length}) — התחל להקליד לסינון`
                : `${filtered.length} תוצאות`}
            </p>

            <ul className="competition-list mt-1">
              {filtered.slice(0, 150).map((league) => (
                <li key={league.id} className="competition-item">
                  <div className="competition-info">
                    {league.badge && (
                      <img src={league.badge} alt="" className="competition-emblem" />
                    )}
                    <div>
                      <strong>{league.name}</strong>
                      <span className="text-muted competition-meta">
                        {[league.country, league.sport !== 'Soccer' ? league.sport : null]
                          .filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </div>
                  <div className="competition-actions">
                    <input
                      type="text"
                      className="form-control season-input"
                      value={getSeason(league.id)}
                      onChange={(e) => setSeason(league.id, e.target.value)}
                      placeholder="עונה"
                      disabled={!!importingId}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => handleImport(league)}
                      disabled={!!importingId}
                    >
                      {importingId === league.id ? '⏳' : '⬇️ ייבא'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {importProgress && (
          <div className="import-progress mt-1">
            <div className="import-spinner" />
            <span>{importProgress}</span>
          </div>
        )}
      </div>

      {/* Existing tournaments */}
      {tournaments.length > 0 && (
        <div className="tournaments-list">
          <h3>טורנירים קיימים</h3>
          {tournaments.map((t) => {
            const s = statusLabel[t.status] || { text: t.status, cls: 'badge-muted' }
            return (
              <div key={t.id} className="tournament-row card">
                <div className="tournament-row-info">
                  {t.emblem && <img src={t.emblem} alt="" className="tournament-emblem" />}
                  <div>
                    <strong>{t.name}</strong>
                    <span className="text-muted tournament-meta">{t.area} · עונה: {t.season}</span>
                  </div>
                  <span className={`badge ${s.cls}`}>{s.text}</span>
                </div>
                <div className="tournament-row-actions">
                  {t.status === 'setup' && (
                    <button className="btn btn-primary" onClick={() => handleActivate(t)}>▶️ הפעל</button>
                  )}
                  {t.status === 'active' && (
                    <button className="btn btn-outline" onClick={() => handleDeactivate(t)}>⏹️ סיים</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AdminTournamentPage
