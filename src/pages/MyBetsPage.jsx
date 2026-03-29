import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import {
  getStaticBet, saveStaticBet,
  getTournamentTeams, getTournamentPlayers,
  getMatchBet, saveMatchBet, getBetLockHours, isMatchLocked,
} from '../services/firebase/bets'
import { getDocs, collection, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
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

const MatchBetRow = ({ match, bet, locked, saving, onSave }) => {
  const [home, setHome] = useState(bet.home != null ? String(bet.home) : '')
  const [away, setAway] = useState(bet.away != null ? String(bet.away) : '')

  // Update local state when bet prop changes (e.g. after save or tournament switch)
  useEffect(() => {
    setHome(bet.home != null ? String(bet.home) : '')
    setAway(bet.away != null ? String(bet.away) : '')
  }, [bet.home, bet.away, match.id])

  const timeStr = match.utcDate
    ? new Date(match.utcDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : match.time || ''
  const dateStr = match.date || match.utcDate?.slice(0, 10) || ''

  const hasChanged = String(home) !== String(bet.home ?? '') || String(away) !== String(bet.away ?? '')

  return (
    <div className={`match-bet-row${locked ? ' match-bet-locked' : ''}`}>
      <div className="match-bet-teams">
        <span className="match-bet-team">
          {match.homeTeam?.badge && <img src={match.homeTeam.badge} alt="" className="match-bet-badge" />}
          {match.homeTeam?.name || '—'}
        </span>
        <div className="match-bet-inputs">
          {locked ? (
            <span className="match-bet-score-locked">
              {bet.home != null ? `${bet.home} : ${bet.away}` : '—'}
            </span>
          ) : (
            <>
              <input
                type="number" min="0" max="30"
                className="form-control match-score-input"
                value={home}
                onChange={e => setHome(e.target.value)}
                disabled={saving}
              />
              <span className="match-bet-colon">:</span>
              <input
                type="number" min="0" max="30"
                className="form-control match-score-input"
                value={away}
                onChange={e => setAway(e.target.value)}
                disabled={saving}
              />
            </>
          )}
        </div>
        <span className="match-bet-team away">
          {match.awayTeam?.name || '—'}
          {match.awayTeam?.badge && <img src={match.awayTeam.badge} alt="" className="match-bet-badge" />}
        </span>
      </div>
      <div className="match-bet-meta">
        <span className="text-muted">{dateStr} · {timeStr}</span>
        {!locked && hasChanged && (
          <button
            className="btn btn-primary btn-sm match-bet-save"
            onClick={() => onSave(match.id, home, away)}
            disabled={saving || home === '' || away === ''}
          >
            {saving ? '⏳' : '💾'}
          </button>
        )}
        {locked && <span className="match-bet-lock-badge">🔒 נעול</span>}
      </div>
    </div>
  )
}

const MyBetsPage = () => {
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const { activeTournaments, loading: tLoading } = useTournament()

  const [selectedId, setSelectedId]   = useState(null)
  const [teams, setTeams]             = useState([])
  const [players, setPlayers]         = useState([])
  const [form, setForm]               = useState(EMPTY)
  const [locked, setLocked]           = useState(false)
  const [saving, setSaving]           = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [allMatches, setAllMatches]   = useState([])
  const [matchBets, setMatchBets]     = useState({})
  const [betLockHours, setBetLockHours] = useState(24)
  const [savingMatch, setSavingMatch] = useState(null)

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
    setAllMatches([])
    setMatchBets({})
    Promise.all([
      getTournamentTeams(activeTournament.id, activeTournament.fromDate || null),
      getTournamentPlayers(activeTournament.id),
      getStaticBet(userProfile.id, activeTournament.id),
      getDocs(query(collection(db, 'tournaments', activeTournament.id, 'matches'), orderBy('utcDate', 'asc'))),
      getMatchBet(userProfile.id, activeTournament.id),
      getBetLockHours(),
    ]).then(([t, p, existing, matchSnap, existingMatchBets, lockHours]) => {
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
      const matchList = matchSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAllMatches(matchList)
      setMatchBets(existingMatchBets?.bets || {})
      setBetLockHours(lockHours)
    }).catch((err) => toast.error('שגיאה בטעינה: ' + err.message))
      .finally(() => setDataLoading(false))
  }, [activeTournament?.id, userProfile.id])

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSaveMatchBet = async (matchId, home, away) => {
    if (home === '' || away === '') return
    setSavingMatch(matchId)
    try {
      await saveMatchBet(userProfile.id, activeTournament.id, matchId, Number(home), Number(away))
      setMatchBets(prev => ({ ...prev, [matchId]: { home: Number(home), away: Number(away) } }))
      toast.success('✅ ניחוש נשמר!')
    } catch (err) {
      toast.error('שגיאה בשמירה: ' + err.message)
    } finally {
      setSavingMatch(null)
    }
  }

  const openStages = (() => {
    if (!activeTournament?.stages?.length) {
      // No stages configured → show all matches under one group
      return allMatches.length > 0 ? [{ value: '__all__', label: 'כל המשחקים' }] : []
    }
    const stages = activeTournament.stages.filter(s => s.imported !== false || s.label?.toLowerCase().includes('group'))
    return stages.filter((stage, idx) => {
      if (idx === 0) return true
      const prevStage = stages[idx - 1]
      const prevMatches = allMatches.filter(m => m.stage === prevStage.value || String(m.round) === prevStage.value)
      if (prevMatches.length === 0) return false
      return prevMatches.every(m => ['finished', 'FINISHED'].includes(m.status))
    })
  })()

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
      <button className="back-link" onClick={() => navigate(-1)}>← חזור</button>
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
        <div className="section-header">
          <h3>📋 ניחושי מחזורים</h3>
          <span className="text-muted section-hint">ניתן לשנות עד {betLockHours} שעות לפני המשחק</span>
        </div>

        {allMatches.length === 0 && (
          <p className="text-muted mt-1">אין משחקים לטורניר זה עדיין</p>
        )}

        {openStages.length === 0 && allMatches.length > 0 && (
          <p className="text-muted mt-1">ניחושי המחזורים יפתחו בקרוב</p>
        )}

        {openStages.map(stage => {
          const stageMatches = stage.value === '__all__'
            ? allMatches
            : allMatches.filter(m => m.stage === stage.value || String(m.round) === stage.value)
          if (stageMatches.length === 0) return null
          return (
            <div key={stage.value} className="round-stage">
              <h4 className="round-stage-title">{stage.label}</h4>
              <div className="round-matches">
                {stageMatches.map(match => {
                  const matchLocked = isMatchLocked(match, betLockHours)
                  const currentBet = matchBets[match.id] || {}
                  return (
                    <MatchBetRow
                      key={match.id}
                      match={match}
                      bet={currentBet}
                      locked={matchLocked}
                      saving={savingMatch === match.id}
                      onSave={handleSaveMatchBet}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MyBetsPage
