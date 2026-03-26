import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import {
  getStaticBet, saveStaticBet,
  getTournamentTeams, getTournamentPlayers,
} from '../services/firebase/bets'
import { toast } from 'react-toastify'
import './MyBetsPage.css'

const EMPTY = {
  champion: '', second: '', third: '', fourth: '',
  topScorer: '', yellowCards: '', redCards: '',
}

// Searchable dropdown component
const SearchSelect = ({ value, onChange, options, placeholder, disabled }) => {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const containerRef      = useRef(null)

  const selected = options.find((o) => o.id === value)

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const select = (id) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={`ss-container${open ? ' ss-open' : ''}`} ref={containerRef}>
      <button
        type="button"
        className={`ss-toggle form-control${disabled ? ' ss-disabled' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className={`ss-value${selected ? '' : ' ss-placeholder'}`}>
          {selected?.badge && <img src={selected.badge} alt="" className="ss-badge" />}
          {selected ? selected.label : placeholder}
        </span>
        <span className="ss-arrow">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="ss-dropdown">
          <input
            autoFocus
            className="ss-search"
            placeholder="חיפוש..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setOpen(false), setQuery(''))}
          />
          <ul className="ss-list">
            <li className="ss-item ss-empty-item" onMouseDown={() => select('')}>
              — {placeholder} —
            </li>
            {filtered.length === 0 && (
              <li className="ss-item ss-no-results">לא נמצאו תוצאות</li>
            )}
            {filtered.map((o) => (
              <li
                key={o.id}
                className={`ss-item${o.id === value ? ' ss-selected' : ''}`}
                onMouseDown={() => select(o.id)}
              >
                {o.badge && <img src={o.badge} alt="" className="ss-badge" />}
                {o.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const MyBetsPage = () => {
  const { userProfile } = useAuth()
  const { activeTournaments, loading: tLoading } = useTournament()

  const [selectedId, setSelectedId]   = useState(null)
  const [teams, setTeams]             = useState([])
  const [players, setPlayers]         = useState([])
  const [form, setForm]               = useState(EMPTY)
  const [locked, setLocked]           = useState(false)
  const [saving, setSaving]           = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

  // When activeTournaments loads/changes, default to first if nothing selected
  useEffect(() => {
    if (activeTournaments.length === 0) return
    setSelectedId((prev) => {
      if (prev && activeTournaments.some((t) => t.id === prev)) return prev
      return activeTournaments[0].id
    })
  }, [activeTournaments])

  const activeTournament = activeTournaments.find((t) => t.id === selectedId) || null

  useEffect(() => {
    if (!activeTournament) { setDataLoading(false); return }
    setDataLoading(true)
    setForm(EMPTY)
    Promise.all([
      getTournamentTeams(activeTournament.id, activeTournament.fromDate || null),
      getTournamentPlayers(activeTournament.id),
      getStaticBet(userProfile.id, activeTournament.id),
    ]).then(([t, p, existing]) => {
      setTeams(t)
      setPlayers(p)
      if (existing) {
        setForm({
          champion:    existing.champion    || '',
          second:      existing.second      || '',
          third:       existing.third       || '',
          fourth:      existing.fourth      || '',
          topScorer:   existing.topScorer   || '',
          yellowCards: existing.yellowCards != null ? String(existing.yellowCards) : '',
          redCards:    existing.redCards    != null ? String(existing.redCards)    : '',
        })
        setLocked(existing.locked === true)
      } else {
        setLocked(false)
      }
    }).catch((err) => toast.error('שגיאה בטעינה: ' + err.message))
      .finally(() => setDataLoading(false))
  }, [activeTournament?.id, userProfile.id])

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    if (locked) return
    setSaving(true)
    try {
      await saveStaticBet(userProfile.id, activeTournament.id, {
        champion:    form.champion    || null,
        second:      form.second      || null,
        third:       form.third       || null,
        fourth:      form.fourth      || null,
        topScorer:   form.topScorer   || null,
        yellowCards: form.yellowCards !== '' ? Number(form.yellowCards) : null,
        redCards:    form.redCards    !== '' ? Number(form.redCards)    : null,
        locked: false,
      })
      toast.success('✅ הניחושים נשמרו!')
    } catch (err) {
      toast.error('שגיאה בשמירה: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (tLoading || (dataLoading && !activeTournament))
    return <div className="card"><p className="text-muted">טוען...</p></div>

  if (activeTournaments.length === 0)
    return (
      <div className="card">
        <h2>🎯 הניחושים שלי</h2>
        <p className="text-muted mt-2">אין טורניר פעיל כרגע.</p>
      </div>
    )

  const teamOptions   = teams.map((t)   => ({ id: t.id, label: t.name, badge: t.badge || '' }))
  const playerOptions = players.map((p) => ({
    id: p.id,
    label: p.name + (p.teamName ? ` · ${p.teamName}` : ''),
  }))

  const TeamSelect = ({ field, label }) => (
    <div className="bet-field">
      <label className="bet-label">{label}</label>
      <SearchSelect
        value={form[field]}
        onChange={(v) => set(field, v)}
        options={teamOptions}
        placeholder="בחר קבוצה"
        disabled={locked}
      />
    </div>
  )

  return (
    <div className="my-bets-page">
      <h2>🎯 הניחושים שלי</h2>

      {activeTournaments.length > 1 && (
        <div className="tournament-tabs">
          {activeTournaments.map((t) => (
            <button
              key={t.id}
              className={`tournament-tab${t.id === selectedId ? ' tournament-tab-active' : ''}`}
              onClick={() => setSelectedId(t.id)}
            >
              {t.emblem && <img src={t.emblem} alt="" className="tab-emblem" />}
              {t.name}
            </button>
          ))}
        </div>
      )}

      {activeTournament && (
        <p className="text-muted tournament-season">
          {activeTournament.name} · עונה {activeTournament.season}
        </p>
      )}

      {locked && (
        <div className="locked-banner">
          🔒 הניחושים הסטטיים נעולים — המשחק הראשון התחיל
        </div>
      )}

      <div className="bets-section card">
        <div className="section-header">
          <h3>🏆 ניחושים סטטיים</h3>
          <span className="text-muted section-hint">נועלים עם תחילת המשחק הראשון</span>
        </div>

        <div className="bets-grid">
          <TeamSelect field="champion" label="🥇 אלוף" />
          <TeamSelect field="second"   label="🥈 מקום 2" />
          <TeamSelect field="third"    label="🥉 מקום 3" />
          <TeamSelect field="fourth"   label="4️⃣ מקום 4" />

          <div className="bet-field">
            <label className="bet-label">⚽ מלך שערים</label>
            <SearchSelect
              value={form.topScorer}
              onChange={(v) => set('topScorer', v)}
              options={playerOptions}
              placeholder="בחר שחקן"
              disabled={locked}
            />
          </div>

          <div className="bet-field">
            <label className="bet-label">🟨 סה"כ כרטיסים צהובים בטורניר</label>
            <input type="number" className="form-control number-input"
              placeholder="מספר" min="0" max="999"
              value={form.yellowCards}
              onChange={(e) => set('yellowCards', e.target.value)}
              disabled={locked} />
          </div>

          <div className="bet-field">
            <label className="bet-label">🟥 סה"כ כרטיסים אדומים בטורניר</label>
            <input type="number" className="form-control number-input"
              placeholder="מספר" min="0" max="99"
              value={form.redCards}
              onChange={(e) => set('redCards', e.target.value)}
              disabled={locked} />
          </div>
        </div>

        {!locked && (
          <button className="btn btn-primary save-btn" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ שומר...' : '💾 שמור ניחושים'}
          </button>
        )}
      </div>

      <div className="bets-section card">
        <h3>📋 ניחושי מחזורים</h3>
        <p className="text-muted mt-1">בקרוב — שלב 8</p>
      </div>
    </div>
  )
}

export default MyBetsPage
