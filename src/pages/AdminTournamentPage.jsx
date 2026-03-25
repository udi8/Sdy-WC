import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { getAllLeagues } from '../services/api/sportsDb'
import { importTournament, activateTournament, deactivateTournament } from '../services/firebase/tournaments'
import { toast } from 'react-toastify'
import './AdminTournamentPage.css'

// Default season based on current month: Aug+ → "2025-2026", else "2024-2025"
const defaultSeason = () => {
  const y = new Date().getFullYear()
  return new Date().getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

const match = (league, term) => {
  const t = term.toLowerCase()
  return (
    league.strLeague?.toLowerCase().includes(t) ||
    league.strLeagueAlternate?.toLowerCase().includes(t) ||
    league.strCountry?.toLowerCase().includes(t) ||
    league.strSport?.toLowerCase().includes(t)
  )
}

const AdminTournamentPage = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [allLeagues, setAllLeagues] = useState([])
  const [loadingAll, setLoadingAll] = useState(false)
  const [leagueSeasons, setLeagueSeasons] = useState({})
  const [importingId, setImportingId] = useState(null)
  const [importProgress, setImportProgress] = useState('')
  const [tournaments, setTournaments] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // Load all leagues once on first focus
  const loadAll = async () => {
    if (allLeagues.length > 0 || loadingAll) return
    setLoadingAll(true)
    try {
      const data = await getAllLeagues()
      setAllLeagues(data.leagues || [])
    } catch (err) {
      toast.error('שגיאה בטעינת ליגות: ' + err.message)
    } finally {
      setLoadingAll(false)
    }
  }

  const filtered = searchTerm.trim().length >= 2
    ? allLeagues.filter((l) => match(l, searchTerm.trim())).slice(0, 50)
    : []

  const leagues = filtered

  const getSeason = (id) => leagueSeasons[id] ?? defaultSeason()

  const handleSeasonChange = (id, val) =>
    setLeagueSeasons((prev) => ({ ...prev, [id]: val }))

  const handleImport = async (league) => {
    if (importingId) return
    const season = getSeason(league.idLeague)
    if (!season.trim()) {
      toast.error('יש להזין עונה')
      return
    }
    const confirmed = window.confirm(
      `לייבא "${league.strLeague}" עונת ${season}?\nקבוצות, שחקנים ומשחקים יישמרו ב-Firebase.`
    )
    if (!confirmed) return

    setImportingId(league.idLeague)
    setImportProgress(`מייבא "${league.strLeague}" עונת ${season}...`)
    try {
      await importTournament(league, season)
      setImportProgress('')
      setSearchTerm('')
      setLeagues([])
      toast.success(`✅ "${league.strLeague}" יובא בהצלחה!`)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה בייבוא: ' + err.message)
      setImportProgress('')
    } finally {
      setImportingId(null)
    }
  }

  const handleActivate = async (t) => {
    try { await activateTournament(t.id); toast.success(`"${t.name}" הופעל!`) }
    catch (err) { toast.error('שגיאה: ' + err.message) }
  }

  const handleDeactivate = async (t) => {
    try { await deactivateTournament(t.id); toast.success(`"${t.name}" סומן כסיום.`) }
    catch (err) { toast.error('שגיאה: ' + err.message) }
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
        <h3>חפש ליגה או תחרות</h3>

        <input
          type="text"
          className="form-control"
          placeholder="למשל: Champions League, World Cup, Premier League, ליגת העל..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={loadAll}
          disabled={!!importingId}
          autoFocus
        />

        {loadingAll && <p className="text-muted mt-1">טוען רשימת ליגות...</p>}
        {!loadingAll && searchTerm.trim().length >= 2 && leagues.length === 0 && (
          <p className="text-muted mt-1">לא נמצאו תוצאות עבור "{searchTerm}"</p>
        )}
        {!loadingAll && searchTerm.trim().length < 2 && searchTerm.trim().length > 0 && (
          <p className="text-muted mt-1">המשך להקליד...</p>
        )}

        {leagues.length > 0 && (
          <ul className="competition-list">
            {leagues.map((league) => {
              const isImporting = importingId === league.idLeague
              const season = getSeason(league.idLeague)
              return (
                <li key={league.idLeague} className="competition-item">
                  <div className="competition-info">
                    {(league.strBadge || league.strLogo) && (
                      <img
                        src={league.strBadge || league.strLogo}
                        alt=""
                        className="competition-emblem"
                      />
                    )}
                    <div>
                      <strong>{league.strLeague}</strong>
                      <span className="text-muted competition-meta">
                        {league.strCountry}
                        {league.strLeagueAlternate ? ` · ${league.strLeagueAlternate}` : ''}
                        {league.strSport && league.strSport !== 'Soccer' ? ` · ${league.strSport}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="competition-actions">
                    <input
                      type="text"
                      className="form-control season-input"
                      value={season}
                      onChange={(e) => handleSeasonChange(league.idLeague, e.target.value)}
                      placeholder="עונה — 2026 / 2025-2026"
                      disabled={isImporting || !!importingId}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => handleImport(league)}
                      disabled={!!importingId}
                    >
                      {isImporting ? '⏳' : '⬇️ ייבא'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {importProgress && (
          <div className="import-progress">
            <div className="import-spinner" />
            <span>{importProgress}</span>
          </div>
        )}
      </div>

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
                    <span className="text-muted tournament-meta">
                      {t.area} · עונה: {t.season}
                    </span>
                  </div>
                  <span className={`badge ${s.cls}`}>{s.text}</span>
                </div>
                <div className="tournament-row-actions">
                  {t.status === 'setup' && (
                    <button className="btn btn-primary" onClick={() => handleActivate(t)}>
                      ▶️ הפעל
                    </button>
                  )}
                  {t.status === 'active' && (
                    <button className="btn btn-outline" onClick={() => handleDeactivate(t)}>
                      ⏹️ סיים
                    </button>
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
