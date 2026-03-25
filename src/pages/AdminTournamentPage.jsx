import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { getAllCompetitions } from '../services/api/footballData'
import { importTournament, activateTournament, deactivateTournament } from '../services/firebase/tournaments'
import { toast } from 'react-toastify'
import './AdminTournamentPage.css'

const AdminTournamentPage = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [allCompetitions, setAllCompetitions] = useState([])
  const [filteredCompetitions, setFilteredCompetitions] = useState([])
  const [loadingCompetitions, setLoadingCompetitions] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [tournaments, setTournaments] = useState([])

  // Load existing tournaments from Firebase
  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // Load competitions from API once
  const loadCompetitions = async () => {
    if (allCompetitions.length > 0) return
    setLoadingCompetitions(true)
    try {
      const data = await getAllCompetitions()
      setAllCompetitions(data.competitions || [])
    } catch (err) {
      toast.error('שגיאה בטעינת תחרויות: ' + err.message)
    } finally {
      setLoadingCompetitions(false)
    }
  }

  // Filter competitions by search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCompetitions([])
      return
    }
    const term = searchTerm.toLowerCase()
    setFilteredCompetitions(
      allCompetitions.filter(
        (c) =>
          c.name?.toLowerCase().includes(term) ||
          c.code?.toLowerCase().includes(term) ||
          c.area?.name?.toLowerCase().includes(term)
      )
    )
  }, [searchTerm, allCompetitions])

  const handleSearchFocus = () => loadCompetitions()

  const handleImport = async (competition) => {
    if (importing) return
    const confirm = window.confirm(
      `לייבא את "${competition.name}"?\nפעולה זו תשמור את כל הקבוצות, השחקנים והמשחקים ב-Firebase.`
    )
    if (!confirm) return

    setImporting(true)
    setImportProgress('מייבא טורניר...')
    try {
      setImportProgress('שומר נתוני טורניר...')
      await importTournament(competition)
      setImportProgress('')
      setSearchTerm('')
      toast.success(`✅ "${competition.name}" יובא בהצלחה!`)
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
    setup:    { text: 'הכנה',  cls: 'badge-warning' },
    active:   { text: 'פעיל',  cls: 'badge-success' },
    finished: { text: 'הסתיים', cls: 'badge-muted'   },
  }

  return (
    <div className="admin-tournament-page">
      <h2>🏆 יצירת טורניר</h2>

      {/* Search */}
      <div className="tournament-search card">
        <h3>חיפוש תחרות מה-API</h3>
        <div className="search-row">
          <input
            type="text"
            className="form-control"
            placeholder="הקלד שם תחרות — למשל: World Cup, Champions League, Premier League..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={handleSearchFocus}
            disabled={importing}
          />
          {loadingCompetitions && (
            <span className="text-muted search-loading">טוען...</span>
          )}
        </div>

        {/* Search results */}
        {filteredCompetitions.length > 0 && (
          <ul className="competition-list">
            {filteredCompetitions.map((comp) => (
              <li key={comp.id} className="competition-item">
                <div className="competition-info">
                  {comp.emblem && (
                    <img src={comp.emblem} alt="" className="competition-emblem" />
                  )}
                  <div>
                    <strong>{comp.name}</strong>
                    <span className="text-muted competition-meta">
                      {comp.area?.name} · {comp.code}
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handleImport(comp)}
                  disabled={importing}
                >
                  {importing ? '⏳ מייבא...' : '⬇️ ייבא'}
                </button>
              </li>
            ))}
          </ul>
        )}

        {searchTerm && !loadingCompetitions && filteredCompetitions.length === 0 && (
          <p className="text-muted mt-1">לא נמצאו תחרויות עבור "{searchTerm}"</p>
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
                      {t.area} · ID: {t.id}
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
