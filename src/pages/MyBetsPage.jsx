import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import {
  getStaticBet, saveStaticBet,
  getTournamentTeams, getTournamentPlayers,
  getMatchBet, saveMatchBet, getBetLockHours, isMatchLocked, scoreMatchBet,
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

const MatchBetRow = ({ match, bet, locked, saving, onSave, onPendingChange }) => {
  const [home, setHome] = useState(bet.home != null ? String(bet.home) : '')
  const [away, setAway] = useState(bet.away != null ? String(bet.away) : '')

  useEffect(() => {
    setHome(bet.home != null ? String(bet.home) : '')
    setAway(bet.away != null ? String(bet.away) : '')
  }, [bet.home, bet.away, match.id])

  const timeStr = match.utcDate
    ? new Date(match.utcDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    : match.time || ''
  const dateStr = match.date || match.utcDate?.slice(0, 10) || ''

  const hasChanged = String(home) !== String(bet.home ?? '') || String(away) !== String(bet.away ?? '')

  const handleHomeChange = (v) => {
    setHome(v)
    onPendingChange?.(match.id, v, away)
  }
  const handleAwayChange = (v) => {
    setAway(v)
    onPendingChange?.(match.id, home, v)
  }

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
                onChange={e => handleHomeChange(e.target.value)}
                disabled={saving}
              />
              <span className="match-bet-colon">:</span>
              <input
                type="number" min="0" max="30"
                className="form-control match-score-input"
                value={away}
                onChange={e => handleAwayChange(e.target.value)}
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
            className="btn btn-ghost btn-sm match-bet-save"
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

const PastMatchesTable = ({ matches, matchBets }) => {
  if (matches.length === 0) return <p className="text-muted mt-1">אין משחקים שהסתיימו עדיין</p>

  const formatDate = (utcDate, date) => {
    const d = utcDate ? new Date(utcDate) : date ? new Date(date) : null
    if (!d) return ''
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="past-matches-table">
        <thead>
          <tr>
            <th>תאריך</th>
            <th>בית</th>
            <th>תוצאה</th>
            <th>אורח</th>
            <th>ניחוש</th>
            <th>נק'</th>
          </tr>
        </thead>
        <tbody>
          {matches.map(m => {
            const bet = matchBets[m.id]
            const result = m.score?.home != null && m.score?.away != null
              ? { home: m.score.home, away: m.score.away } : null
            const pts = bet && result ? scoreMatchBet(bet, result) : null
            return (
              <tr key={m.id} className={pts > 0 ? 'past-row-scored' : ''}>
                <td className="past-date">{formatDate(m.utcDate, m.date)}</td>
                <td className="past-team">
                  {m.homeTeam?.badge && <img src={m.homeTeam.badge} alt="" className="past-badge" />}
                  <span>{m.homeTeam?.name || '—'}</span>
                </td>
                <td className="past-score">
                  {result ? `${result.home}:${result.away}` : '—'}
                </td>
                <td className="past-team past-away">
                  <span>{m.awayTeam?.name || '—'}</span>
                  {m.awayTeam?.badge && <img src={m.awayTeam.badge} alt="" className="past-badge" />}
                </td>
                <td className="past-bet">
                  {bet ? `${bet.home}:${bet.away}` : <span className="text-muted">—</span>}
                </td>
                <td className="past-pts">
                  {pts !== null ? (
                    <span className={pts > 0 ? 'pts-positive' : 'pts-zero'}>{pts}</span>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
  const [savingMatch, setSavingMatch]   = useState(null)
  const [savingRound, setSavingRound]   = useState(false)
  const [pendingBets, setPendingBets]   = useState({})
  const [matchTab, setMatchTab]         = useState('future')

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
    setMatchTab('future')
    setPendingBets({})
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

  const handlePendingChange = (matchId, home, away) => {
    setPendingBets(prev => ({ ...prev, [matchId]: { home, away } }))
  }

  const handleSaveMatchBet = async (matchId, home, away) => {
    if (home === '' || away === '') return
    setSavingMatch(matchId)
    try {
      await saveMatchBet(userProfile.id, activeTournament.id, matchId, Number(home), Number(away))
      setMatchBets(prev => ({ ...prev, [matchId]: { home: Number(home), away: Number(away) } }))
      setPendingBets(prev => { const n = { ...prev }; delete n[matchId]; return n })
      toast.success('✅ ניחוש נשמר!')
    } catch (err) {
      toast.error('שגיאה בשמירה: ' + err.message)
    } finally {
      setSavingMatch(null)
    }
  }

  const handleSaveRound = async (matchIds) => {
    const toSave = matchIds.filter(id => {
      const p = pendingBets[id]
      return p && p.home !== '' && p.away !== ''
    })
    if (toSave.length === 0) return
    setSavingRound(true)
    try {
      await Promise.all(toSave.map(id => {
        const { home, away } = pendingBets[id]
        return saveMatchBet(userProfile.id, activeTournament.id, id, Number(home), Number(away))
      }))
      const updates = {}
      const cleared = { ...pendingBets }
      for (const id of toSave) {
        updates[id] = { home: Number(pendingBets[id].home), away: Number(pendingBets[id].away) }
        delete cleared[id]
      }
      setMatchBets(prev => ({ ...prev, ...updates }))
      setPendingBets(cleared)
      toast.success(`✅ ${toSave.length} ניחושים נשמרו!`)
    } catch (err) {
      toast.error('שגיאה בשמירה: ' + err.message)
    } finally {
      setSavingRound(false)
    }
  }

  // Compute grouped structure for future matches + past matches list
  const { futureGroups, pastMatches } = useMemo(() => {
    if (!activeTournament) return { futureGroups: [], pastMatches: [] }

    const past = allMatches
      .filter(m => m.status === 'finished')
      .sort((a, b) => new Date(b.utcDate || b.date) - new Date(a.utcDate || a.date))

    const future = allMatches.filter(m => m.status !== 'finished')

    // Group by stage, preserving tournament.stages order
    const stageOrder = (activeTournament.stages || []).map(s => s.value)
    const stageMap = new Map()
    for (const m of future) {
      const key = m.stage || '__no_stage__'
      if (!stageMap.has(key)) stageMap.set(key, [])
      stageMap.get(key).push(m)
    }

    const stageEntries = Array.from(stageMap.entries()).sort((a, b) => {
      const ai = stageOrder.indexOf(a[0]); const bi = stageOrder.indexOf(b[0])
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })

    const groups = []
    for (const [stageKey, stageMatches] of stageEntries) {
      const stageMeta = (activeTournament.stages || []).find(s => s.value === stageKey)
      const stageLabel = stageMeta?.label || (stageKey === '__no_stage__' ? 'משחקים' : stageKey)

      // Group by round within stage
      const roundMap = new Map()
      for (const m of stageMatches) {
        const rk = m.round != null ? m.round : '__no_round__'
        if (!roundMap.has(rk)) roundMap.set(rk, [])
        roundMap.get(rk).push(m)
      }

      const sortedRounds = Array.from(roundMap.entries()).sort((a, b) => {
        const ra = a[0] === '__no_round__' ? 9999 : Number(a[0])
        const rb = b[0] === '__no_round__' ? 9999 : Number(b[0])
        return ra - rb
      })

      const hasMultipleRounds = sortedRounds.length > 1

      for (let i = 0; i < sortedRounds.length; i++) {
        const [roundKey, roundMatches] = sortedRounds[i]
        const sorted = [...roundMatches].sort(
          (a, b) => new Date(a.utcDate || a.date) - new Date(b.utcDate || b.date)
        )

        let roundLocked
        if (i === 0 || !hasMultipleRounds) {
          // First round or single-round stage: hours-based lock on earliest match
          roundLocked = sorted[0] ? isMatchLocked(sorted[0], betLockHours) : false
        } else {
          // Later rounds in multi-round (group) stage: lock until previous round all finished
          const prevMatches = sortedRounds[i - 1][1]
          roundLocked = !prevMatches.every(m => m.status === 'finished')
        }

        const roundLabel = hasMultipleRounds && roundKey !== '__no_round__'
          ? `${stageLabel} — מחזור ${roundKey}`
          : stageLabel

        groups.push({ stageKey, stageLabel, roundKey, roundLabel, matches: sorted, locked: roundLocked })
      }
    }

    return { futureGroups: groups, pastMatches: past }
  }, [allMatches, activeTournament, betLockHours])

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
          <span className="text-muted section-hint">ניתן לשנות עד {betLockHours} שעות לפני</span>
        </div>

        {allMatches.length > 0 && (
          <div className="match-tabs">
            <button
              className={`match-tab${matchTab === 'future' ? ' match-tab-active' : ''}`}
              onClick={() => setMatchTab('future')}
            >
              ⏱️ עתידיים
            </button>
            <button
              className={`match-tab${matchTab === 'past' ? ' match-tab-active' : ''}`}
              onClick={() => setMatchTab('past')}
            >
              📊 היסטוריה
            </button>
          </div>
        )}

        {allMatches.length === 0 && (
          <p className="text-muted mt-1">אין משחקים לטורניר זה עדיין</p>
        )}

        {matchTab === 'future' && (
          <>
            {futureGroups.length === 0 && allMatches.length > 0 && (
              <p className="text-muted mt-1">אין משחקים עתידיים</p>
            )}
            {futureGroups.map(group => {
              const roundPending = group.matches.some(m => {
                const p = pendingBets[m.id]
                return p && p.home !== '' && p.away !== ''
              })
              return (
                <div key={`${group.stageKey}-${group.roundKey}`} className="round-stage">
                  <h4 className="round-stage-title">
                    {group.roundLabel}
                    {group.locked && <span className="round-locked-badge">🔒 נעול</span>}
                  </h4>
                  <div className="round-matches">
                    {group.matches.map(match => (
                      <MatchBetRow
                        key={match.id}
                        match={match}
                        bet={matchBets[match.id] || {}}
                        locked={group.locked}
                        saving={savingMatch === match.id}
                        onSave={handleSaveMatchBet}
                        onPendingChange={handlePendingChange}
                      />
                    ))}
                  </div>
                  {!group.locked && roundPending && (
                    <button
                      className="btn btn-primary save-round-btn"
                      onClick={() => handleSaveRound(group.matches.map(m => m.id))}
                      disabled={savingRound}
                    >
                      {savingRound ? '⏳ שומר...' : '💾 שמור סבב'}
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}

        {matchTab === 'past' && (
          <PastMatchesTable
            matches={pastMatches}
            matchBets={matchBets}
          />
        )}
      </div>
    </div>
  )
}

export default MyBetsPage
