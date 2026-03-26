import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { getLeague } from '../services/api/sportsDb'
import { POPULAR_LEAGUES } from '../data/leagues'
import { importTournament, addManualTeams, activateTournament, deactivateTournament, deleteTournament, importFromFootballData, importFromESPN, syncTournamentMatches, syncTeamBadges } from '../services/firebase/tournaments'
import { toast } from 'react-toastify'
import './AdminTournamentPage.css'
import { seasonToEndDate, seasonToStartDate } from '../utils/season'

const defaultSeason = () => {
  const y = new Date().getFullYear()
  return new Date().getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

const AdminTournamentPage = () => {
  const [search, setSearch]           = useState('')
  const [customId, setCustomId]       = useState('')
  const [customResult, setCustomResult] = useState(null)
  const [fetchingCustom, setFetchingCustom] = useState(false)
  const [seasons, setSeasons]         = useState({})
  const [fromDates, setFromDates]     = useState({})
  const [importingId, setImportingId]     = useState(null)
  const [deletingId, setDeletingId]       = useState(null)
  const [syncingMatchesId, setSyncingMatchesId] = useState(null)
  const [syncingBadgesId, setSyncingBadgesId]   = useState(null)
  const [importProgress, setImportProgress] = useState('')
  const [tournaments, setTournaments] = useState([])
  const [fdCode, setFdCode]           = useState('')
  const [fdSeason, setFdSeason]       = useState('2026')
  const [fdImporting, setFdImporting] = useState(false)
  const [fdProgress, setFdProgress]   = useState('')
  const [espnSport, setEspnSport]     = useState('soccer')
  const [espnLeague, setEspnLeague]   = useState('')
  const [espnStart, setEspnStart]     = useState('')
  const [espnEnd, setEspnEnd]         = useState('')
  const [espnImporting, setEspnImporting] = useState(false)
  const [espnImportingId, setEspnImportingId] = useState(null)
  const [espnProgress, setEspnProgress]   = useState('')

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) =>
      setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])

  const term = search.trim().toLowerCase()
  const filtered = term.length < 1
    ? POPULAR_LEAGUES
    : POPULAR_LEAGUES.filter((l) =>
        l.name.toLowerCase().includes(term) ||
        l.altName?.toLowerCase().includes(term) ||
        l.country.toLowerCase().includes(term) ||
        l.sport.toLowerCase().includes(term)
      )

  const leagueSeason = (id) => POPULAR_LEAGUES.find((l) => l.id === id)?.defaultSeason ?? defaultSeason()
  const getSeason   = (id) => seasons[id]   ?? leagueSeason(id)
  const setSeason   = (id, val) => setSeasons((p)   => ({ ...p, [id]: val }))
  const getFromDate = (id) => fromDates[id] ?? ''
  const setFromDate = (id, val) => setFromDates((p) => ({ ...p, [id]: val }))

  // Look up a custom league by TheSportsDB ID
  const handleCustomLookup = async () => {
    if (!customId.trim()) return
    setFetchingCustom(true)
    setCustomResult(null)
    try {
      const data = await getLeague(customId.trim())
      const l = data.leagues?.[0]
      if (!l) { toast.error(`לא נמצאה ליגה עם ID ${customId}`); return }
      setCustomResult({
        id: l.idLeague,
        name: l.strLeague,
        altName: l.strLeagueAlternate || '',
        country: l.strCountry || '',
        sport: l.strSport || 'Soccer',
        badge: l.strBadge || l.strLogo || '',
        _full: l,
      })
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    } finally {
      setFetchingCustom(false)
    }
  }

  const handleImport = async (league) => {
    const season   = getSeason(league.id)
    const fromDate = getFromDate(league.id).trim() || null
    if (!season.trim()) { toast.error('יש להזין עונה'); return }
    const note = fromDate ? ` (קבוצות מ-${fromDate})` : ''
    if (!window.confirm(`לייבא "${league.name}" עונת ${season}${note}?`)) return

    setImportingId(league.id)
    setImportProgress(`מייבא "${league.name}" עונת ${season}${note}...`)
    try {
      // Fetch full details if we only have static data (no badge etc.)
      let fullLeague = league._full
      if (!fullLeague) {
        try {
          const data = await getLeague(league.id)
          fullLeague = data.leagues?.[0]
        } catch { /* ignore */ }
        if (!fullLeague) {
          // Build minimal object from static data
          fullLeague = {
            idLeague: league.id, strLeague: league.name,
            strLeagueAlternate: league.altName || '',
            strCountry: league.country, strSport: league.sport,
          }
        }
      }
      await importTournament(fullLeague, season, fromDate)
      setImportProgress('')
      setCustomResult(null)
      setCustomId('')
      toast.success(`✅ "${league.name}" יובא בהצלחה!`)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה בייבוא: ' + err.message)
      setImportProgress('')
    } finally {
      setImportingId(null)
    }
  }

  const handleESPNImportForLeague = async (league) => {
    const season    = getSeason(league.id)
    const startDate = getFromDate(league.id).trim() || new Date().toISOString().slice(0, 10)
    const endDate   = seasonToEndDate(season)

    if (!endDate) { toast.error('יש להזין עונה'); return }
    if (!window.confirm(`לייבא "${league.name}" עונת ${season} מ-ESPN (${startDate} → ${endDate})?`)) return

    setEspnImportingId(league.id)
    setImportingId(league.id)
    setImportProgress(`מייבא "${league.name}" מ-ESPN...`)
    try {
      const result = await importFromESPN(
        league.espnSport,
        league.espnId,
        startDate,
        endDate,
      )
      setImportProgress('')
      toast.success(`✅ "${result.name}" יובא מ-ESPN (${result.matchCount} משחקים, ${result.playerCount} שחקנים)`)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה בייבוא ESPN: ' + err.message)
      setImportProgress('')
    } finally {
      setEspnImportingId(null)
      setImportingId(null)
    }
  }

  const handleSyncMatches = async (t) => {
    setSyncingMatchesId(t.id)
    try {
      const added = await syncTournamentMatches(t.id)
      toast.success(`✅ סנכרון הושלם — ${added} משחקים חדשים נוספו`)
    } catch (err) {
      toast.error('שגיאה בסנכרון: ' + err.message)
    } finally {
      setSyncingMatchesId(null)
    }
  }

  const handleSyncBadges = async (t) => {
    setSyncingBadgesId(t.id)
    try {
      const updated = await syncTeamBadges(t.id)
      toast.success(`✅ לוגואים עודכנו — ${updated} משחקים`)
    } catch (err) {
      toast.error('שגיאה בעדכון לוגואים: ' + err.message)
    } finally {
      setSyncingBadgesId(null)
    }
  }

  const handleDelete = async (t) => {
    if (!window.confirm(`למחוק את "${t.name}" ואת כל נתוני המשחקים/שחקנים שלו? פעולה זו בלתי הפיכה.`)) return
    setDeletingId(t.id)
    try {
      await deleteTournament(t.id)
      toast.success(`"${t.name}" נמחק.`)
    } catch (err) {
      toast.error('שגיאה במחיקה: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleFDImport = async () => {
    const code = fdCode.trim().toUpperCase()
    if (!code)          { toast.error('יש להזין קוד תחרות'); return }
    if (!fdSeason.trim()) { toast.error('יש להזין עונה'); return }
    if (!window.confirm(`לייבא "${code}" עונת ${fdSeason} מ-football-data.org?`)) return

    setFdImporting(true)
    setFdProgress(`מייבא "${code}" עונת ${fdSeason}...`)
    try {
      const result = await importFromFootballData(code, fdSeason)
      setFdCode('')
      setFdProgress('')
      toast.success(`✅ "${result.name}" יובא (${result.matchCount} משחקים, ${result.playerCount} שחקנים)`)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה: ' + err.message)
      setFdProgress('')
    } finally {
      setFdImporting(false)
    }
  }

  const handleESPNImport = async () => {
    if (!espnLeague.trim()) { toast.error('יש להזין קוד ליגה'); return }
    if (!espnStart || !espnEnd) { toast.error('יש להזין תאריך התחלה וסיום'); return }
    if (!window.confirm(`לייבא "${espnSport}/${espnLeague}" (${espnStart} → ${espnEnd}) מ-ESPN?`)) return
    setEspnImporting(true)
    setEspnProgress(`מייבא ${espnLeague}...`)
    try {
      const result = await importFromESPN(espnSport, espnLeague.trim().toLowerCase(), espnStart, espnEnd)
      setEspnLeague('')
      setEspnProgress('')
      toast.success(`✅ "${result.name}" יובא (${result.matchCount} משחקים, ${result.playerCount} שחקנים)`)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה: ' + err.message)
      setEspnProgress('')
    } finally {
      setEspnImporting(false)
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

  const LeagueRow = ({ league }) => (
    <li className="competition-item">
      <div className="competition-info">
        {league.badge && <img src={league.badge} alt="" className="competition-emblem" />}
        <div>
          <strong>{league.name}{league.altName ? ` / ${league.altName}` : ''}</strong>
          <span className="text-muted competition-meta">
            {[league.country, league.sport !== 'Soccer' ? league.sport : null].filter(Boolean).join(' · ')}
            {league.espnId  && <span className="badge badge-muted" style={{ marginRight: '0.4rem' }}>ESPN</span>}
            {league.fdCode  && <span className="badge badge-muted" style={{ marginRight: '0.4rem' }}>FD:{league.fdCode}</span>}
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
        {league.espnId && (
          <input
            type="date"
            className="form-control season-input"
            value={getFromDate(league.id)}
            onChange={(e) => setFromDate(league.id, e.target.value)}
            title="תאריך התחלה (אופציונלי — ברירת מחדל: היום)"
            disabled={!!importingId}
          />
        )}
        {league.espnId ? (
          <button
            className="btn btn-primary"
            onClick={() => handleESPNImportForLeague(league)}
            disabled={!!importingId}
            title="ייבא מ-ESPN (מומלץ)"
          >
            {espnImportingId === league.id ? '⏳' : '⬇️ ESPN'}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => handleImport(league)}
            disabled={!!importingId}
          >
            {importingId === league.id ? '⏳' : '⬇️ ייבא'}
          </button>
        )}
      </div>
    </li>
  )

  return (
    <div className="admin-tournament-page">
      <h2>🏆 יצירת טורניר</h2>

      {/* Popular list with search */}
      <div className="tournament-search card">
        <div className="search-header">
          <h3>בחר ליגה או תחרות</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()} title="רענן דף">🔄 רענן</button>
        </div>
        <input
          type="text"
          className="form-control"
          placeholder="חפש — World Cup, Champions League, ליגת העל, Israel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={!!importingId}
          autoFocus
        />
        {term.length > 0 && (
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
            {filtered.length} תוצאות
          </p>
        )}

        <ul className="competition-list mt-1">
          {filtered.map((l) => <LeagueRow key={l.id} league={l} />)}
        </ul>

        {filtered.length === 0 && (
          <p className="text-muted mt-1">לא נמצאו תוצאות — נסה חיפוש לפי ID למטה</p>
        )}

        {importProgress && (
          <div className="import-progress mt-1">
            <div className="import-spinner" />
            <span>{importProgress}</span>
          </div>
        )}
      </div>

      {/* Custom ID lookup */}
      <div className="tournament-search card">
        <h3>ייבוא לפי ID מ-TheSportsDB</h3>
        <p className="text-muted caption-text">
          לא מצאת? גש ל-<strong>thesportsdb.com</strong>, חפש את הטורניר,
          העתק את ה-ID מה-URL (למשל: <code>4480</code>) והדבק כאן.
        </p>
        <div className="search-row">
          <input
            type="text"
            className="form-control"
            placeholder="מספר ID — למשל 4480"
            value={customId}
            onChange={(e) => { setCustomId(e.target.value); setCustomResult(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomLookup()}
            disabled={!!importingId}
          />
          <button
            className="btn btn-primary"
            onClick={handleCustomLookup}
            disabled={fetchingCustom || !!importingId}
          >
            {fetchingCustom ? '⏳' : '🔍 שלוף'}
          </button>
        </div>

        {customResult && (
          <ul className="competition-list mt-1">
            <LeagueRow league={customResult} />
          </ul>
        )}
      </div>

      {/* football-data.org import */}
      <div className="tournament-search card">
        <h3>ייבוא מ-football-data.org</h3>
        <p className="text-muted caption-text">
          ייבוא מלא — 48+ קבוצות, כל המשחקים, שחקנים. דורש{' '}
          <strong>Cloudflare Worker</strong> עם API key (ראה <code>workers/football-proxy/</code>).
          קודים: <code>WC</code> · <code>CL</code> · <code>PL</code> · <code>BL1</code> · <code>SA</code> · <code>FL1</code>
        </p>
        <div className="search-row">
          <input
            type="text"
            className="form-control"
            placeholder="קוד — WC / CL / PL"
            value={fdCode}
            onChange={(e) => setFdCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleFDImport()}
            disabled={fdImporting}
            style={{ maxWidth: '160px' }}
          />
          <input
            type="text"
            className="form-control season-input"
            placeholder="עונה — 2026"
            value={fdSeason}
            onChange={(e) => setFdSeason(e.target.value)}
            disabled={fdImporting}
          />
          <button
            className="btn btn-primary"
            onClick={handleFDImport}
            disabled={fdImporting || !fdCode.trim()}
          >
            {fdImporting ? '⏳' : '⬇️ ייבא'}
          </button>
        </div>
        {fdProgress && (
          <div className="import-progress mt-1">
            <div className="import-spinner" />
            <span>{fdProgress}</span>
          </div>
        )}
      </div>

      {/* ESPN manual import — advanced, collapsed by default */}
      <details className="tournament-search card">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          ייבוא ידני מ-ESPN <span className="badge badge-muted">מתקדם</span>
        </summary>
        <p className="text-muted caption-text" style={{ marginTop: '0.5rem' }}>
          לייבוא ליגות שאינן ברשימה. קוד הליגה: <code>eng.1</code> / <code>isr.1</code> / <code>fifa.world</code>
        </p>
        <div className="search-row">
          <input
            className="form-control season-input"
            placeholder="ספורט (soccer)"
            value={espnSport}
            onChange={(e) => setEspnSport(e.target.value)}
            disabled={espnImporting}
          />
          <input
            className="form-control season-input"
            placeholder="קוד ליגה: eng.1 / isr.1"
            value={espnLeague}
            onChange={(e) => setEspnLeague(e.target.value)}
            disabled={espnImporting}
          />
          <input type="date" className="form-control season-input"
            value={espnStart} onChange={(e) => setEspnStart(e.target.value)}
            disabled={espnImporting} title="תאריך התחלה" />
          <input type="date" className="form-control season-input"
            value={espnEnd} onChange={(e) => setEspnEnd(e.target.value)}
            disabled={espnImporting} title="תאריך סיום" />
          <button
            className="btn btn-primary"
            onClick={handleESPNImport}
            disabled={espnImporting || !espnLeague.trim() || !espnStart || !espnEnd}
          >
            {espnImporting ? '⏳' : '⬇️ ייבא'}
          </button>
        </div>
        {espnProgress && (
          <div className="import-progress mt-1">
            <div className="import-spinner" />
            <span>{espnProgress}</span>
          </div>
        )}
      </details>

      {/* Existing tournaments */}
      {tournaments.length > 0 && (
        <div className="tournaments-list">
          <div className="tournaments-list-header">
            <h3>טורנירים קיימים</h3>
            <button
              className="btn btn-ghost"
              onClick={() => window.location.reload()}
              title="רענן רשימה"
            >
              🔄 רענן
            </button>
          </div>
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
                  {t.espnLeague && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleSyncMatches(t)}
                      disabled={!!syncingMatchesId || !!syncingBadgesId}
                      title="סנכרן משחקים חדשים מ-ESPN"
                    >
                      {syncingMatchesId === t.id ? '⏳' : '🔄 משחקים'}
                    </button>
                  )}
                  {t.espnLeague && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleSyncBadges(t)}
                      disabled={!!syncingMatchesId || !!syncingBadgesId}
                      title="עדכן לוגואים/דגלים מ-ESPN"
                    >
                      {syncingBadgesId === t.id ? '⏳' : '🖼️ לוגואים'}
                    </button>
                  )}
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(t)}
                    disabled={!!deletingId}
                    title="מחק טורניר ואת כל הנתונים שלו"
                  >
                    {deletingId === t.id ? '⏳' : '🗑️'}
                  </button>
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
