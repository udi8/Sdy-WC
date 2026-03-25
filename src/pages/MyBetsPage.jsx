import { useState, useEffect } from 'react'
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

const MyBetsPage = () => {
  const { userProfile } = useAuth()
  const { activeTournament, loading: tLoading } = useTournament()

  const [teams, setTeams]         = useState([])
  const [players, setPlayers]     = useState([])
  const [form, setForm]           = useState(EMPTY)
  const [locked, setLocked]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!activeTournament) { setDataLoading(false); return }
    setDataLoading(true)
    Promise.all([
      getTournamentTeams(activeTournament.id),
      getTournamentPlayers(activeTournament.id),
      getStaticBet(userProfile.uid, activeTournament.id),
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
      }
    }).catch((err) => toast.error('שגיאה בטעינה: ' + err.message))
      .finally(() => setDataLoading(false))
  }, [activeTournament, userProfile.uid])

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSave = async () => {
    if (locked) return
    setSaving(true)
    try {
      await saveStaticBet(userProfile.uid, activeTournament.id, {
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

  if (tLoading || dataLoading)
    return <div className="card"><p className="text-muted">טוען...</p></div>

  if (!activeTournament)
    return (
      <div className="card">
        <h2>🎯 הניחושים שלי</h2>
        <p className="text-muted mt-2">אין טורניר פעיל כרגע.</p>
      </div>
    )

  const TeamSelect = ({ field, label }) => (
    <div className="bet-field">
      <label className="bet-label">{label}</label>
      <select className="form-control" value={form[field]}
        onChange={(e) => set(field, e.target.value)} disabled={locked}>
        <option value="">— בחר קבוצה —</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
  )

  return (
    <div className="my-bets-page">
      <h2>🎯 הניחושים שלי</h2>
      <p className="text-muted tournament-season">
        {activeTournament.name} · עונה {activeTournament.season}
      </p>

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
            <select className="form-control" value={form.topScorer}
              onChange={(e) => set('topScorer', e.target.value)} disabled={locked}>
              <option value="">— בחר שחקן —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.teamName ? ` · ${p.teamName}` : ''}
                </option>
              ))}
            </select>
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
