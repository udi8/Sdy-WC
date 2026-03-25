import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { searchLeagues } from '../services/api/sportsDb'
import { importTournament, activateTournament, deactivateTournament } from '../services/firebase/tournaments'
import { toast } from 'react-toastify'
import './AdminTournamentPage.css'

const currentYear = new Date().getFullYear()
const seasonOptions = [currentYear - 1, currentYear, currentYear + 1]

const AdminTournamentPage = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [leagues, setLeagues] = useState([])
  const [searching, setSearching] = useState(false)
  const [season, setSeason] = useState(String(currentYear))
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [tournaments, setTournaments] = useState([])
  const debounceRef = useRef(null)

  // Load existing tournaments from Firebase
  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // Debounced search as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchTerm.trim()) {
      setLeagues([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchLeagues(searchTerm.trim())
        setLeagues(data.leagues || [])
      } catch (err) {
        toast.error('שגיאה בחיפוש: ' + err.message)
        setLeagues([])
      } finally {
        setSearching(false)
      }
    }, 500)
  }, [searchTerm])

  const handleImport = async (league) => {
    if (importing) return
    const seasonLabel = `${season}-${Number(season) + 1}`
    const confirmed = window.confirm(
      `לייבא את "${league.strLeague}" עונת ${seasonLabel}?\nפעולה זו תשמור את כל הקבוצות, השחקנים והמשחקים ב-Firebase.`
    )
    if (!confirmed) return

    setImporting(true)
    setImportProgress('מייבא טורניר...')
    try {
      setImportProgress('שומר נתוני טורניר, קבוצות ושחקנים...')
      await importTournament(league, seasonLabel)
      setImportProgress('')
      setSearchTerm('')
      setLeagues([])
      toast.success(`✅ "${league.strLeague}" יובא בהצלחה!`)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה בייבוא: ' + err.message)
      setImportProgress('')
    } finally {
      setImporting(false)
    }
  }

  const handleActivate = async (t) => {
    try {
      await activateTournament(t.id)
      toast.success(`"${t.name}" הופעל!`)
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
  }

  const handleDeactivate = async (t) => {
    try {
      await deactivateTournament(t.id)
      toast.success(`"${t.name}" סומן כסיום.`)
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
  }

  const statusLabel = {
    setup:    { text: 'הכנה',   cls: 'badge-warning' },
    active:   { text: 'פעיל',   cls: 'badge-success' },
    finished: { text: 'הסתיים', cls: 'badge-muted'   },
  }

  return (
    <div className="admin-tournament-page">
      <h2>🏆 יצירת טורניר</h2>

      {/* Search */}
      <div className="tournament-search card">
        <h3>חיפוש ליגה / תחרות</h3>

        <div className="search-season-row">
          <input
            type="text"
            className="form-control"
            placeholder="הקלד שם ליגה — למשל: World Cup, Champions League, Premier League..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={importing}
          />
          <select
            className="form-control season-select"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            disabled={importing}
          >
            {seasonOptions.map((y) => (
              <option key={y} value={String(y)}>
                {y}-{y + 1}
              </option>
            ))}
          </select>
        </div>

        {searching && <p className="text-muted mt-1">מחפש...</p>}

        {/* Search results */}
        {leagues.length > 0 && (
          <ul className="competition-list">
            {leagues.map((league) => (
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
                <button
                  className="btn btn-primary"
                  onClick={() => handleImport(league)}
                  disabled={importing}
                >
                  {importing ? '⏳ מייבא...' : '⬇️ ייבא'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {searchTerm && !searching && leagues.length === 0 && (
          <p className="text-muted mt-1">לא נמצאו ליגות עבור "{searchTerm}"</p>
        )}

        {/* Import progress */}
        {importProgress && (
          <div className="import-progress">
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
                  {t.emblem && (
                    <img src={t.emblem} alt="" className="tournament-emblem" />
                  )}
                  <div>
                    <strong>{t.name}</strong>
                    <span className="text-muted tournament-meta">
                      {t.area} · עונה: {t.season} · ID: {t.id}
                    </span>
                  </div>
                  <span className={`badge ${s.cls}`}>{s.text}</span>
                </div>

                <div className="tournament-row-actions">
                  {t.status === 'setup' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleActivate(t)}
                    >
                      ▶️ הפעל
                    </button>
                  )}
                  {t.status === 'active' && (
                    <button
                      className="btn btn-outline"
                      onClick={() => handleDeactivate(t)}
                    >
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
