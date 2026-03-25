import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { getAllLeagues, getLeague } from '../services/api/sportsDb'
import { importTournament, activateTournament, deactivateTournament } from '../services/firebase/tournaments'
import { toast } from 'react-toastify'
import './AdminTournamentPage.css'

const defaultSeason = () => {
  const y = new Date().getFullYear()
  return new Date().getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

const AdminTournamentPage = () => {
  const [allLeagues, setAllLeagues]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [seasons, setSeasons]         = useState({})
  const [importingId, setImportingId] = useState(null)
  const [importProgress, setImportProgress] = useState('')
  const [tournaments, setTournaments] = useState([])

  // Load all leagues on mount
  useEffect(() => {
    getAllLeagues()
      .then((data) => setAllLeagues(data.leagues || []))
      .catch((err) => toast.error('שגיאה בטעינה: ' + err.message))
      .finally(() => setLoading(false))
  }, [])

  // Load existing tournaments
  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) =>
      setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])

  const term = search.trim().toLowerCase()
  const filtered = term.length < 2
    ? allLeagues
    : allLeagues.filter((l) =>
        l.strLeague?.toLowerCase().includes(term) ||
        l.strLeagueAlternate?.toLowerCase().includes(term) ||
        l.strSport?.toLowerCase().includes(term)
      )

  const getSeason = (id) => seasons[id] ?? defaultSeason()
  const setSeason = (id, val) => setSeasons((p) => ({ ...p, [id]: val }))

  const handleImport = async (league) => {
    // If we only have basic data (from getAllLeagues), fetch full details first
    let fullLeague = league
    if (!league.strCountry && !league.strBadge) {
      try {
        const data = await getLeague(league.idLeague)
        fullLeague = data.leagues?.[0] || league
      } catch { /* use basic data */ }
    }

    const season = getSeason(league.idLeague)
    if (!season.trim()) { toast.error('יש להזין עונה'); return }
    if (!window.confirm(`לייבא "${fullLeague.strLeague}" עונת ${season}?`)) return

    setImportingId(league.idLeague)
    setImportProgress(`מייבא "${fullLeague.strLeague}" עונת ${season}...`)
    try {
      await importTournament(fullLeague, season)
      setImportProgress('')
      toast.success(`✅ "${fullLeague.strLeague}" יובא בהצלחה!`)
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
        <h3>בחר ליגה או תחרות</h3>

        <input
          type="text"
          className="form-control"
          placeholder={loading ? 'טוען רשימת ליגות...' : `חפש מתוך ${allLeagues.length} ליגות — World Cup, Champions League, ליגת העל...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading || !!importingId}
          autoFocus
        />

        {loading && (
          <div className="import-progress mt-1">
            <div className="import-spinner" />
            <span>טוען רשימת ליגות מ-TheSportsDB...</span>
          </div>
        )}

        {!loading && (
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
            מציג {Math.min(filtered.length, 100)} מתוך {filtered.length} תוצאות
          </p>
        )}

        {!loading && filtered.length > 0 && (
          <ul className="competition-list mt-1">
            {filtered.slice(0, 100).map((league) => (
              <li key={league.idLeague} className="competition-item">
                <div className="competition-info">
                  <div>
                    <strong>{league.strLeague}</strong>
                    <span className="text-muted competition-meta">
                      {[league.strSport, league.strLeagueAlternate].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </div>
                <div className="competition-actions">
                  <input
                    type="text"
                    className="form-control season-input"
                    value={getSeason(league.idLeague)}
                    onChange={(e) => setSeason(league.idLeague, e.target.value)}
                    placeholder="עונה"
                    disabled={!!importingId}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => handleImport(league)}
                    disabled={!!importingId}
                  >
                    {importingId === league.idLeague ? '⏳' : '⬇️ ייבא'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
