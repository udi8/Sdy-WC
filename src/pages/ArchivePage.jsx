import { Link } from 'react-router-dom'
import { useTournament } from '../contexts/TournamentContext'
import './ArchivePage.css'

const ArchivePage = () => {
  const { finishedTournaments, loading } = useTournament()

  return (
    <div className="archive-page">
      <h2>📦 ארכיון טורנירים</h2>

      {loading ? (
        <p className="text-muted">טוען...</p>
      ) : finishedTournaments.length === 0 ? (
        <p className="text-muted">אין טורנירים שהסתיימו עדיין</p>
      ) : (
        <div className="archive-list">
          {finishedTournaments.map(t => (
            <Link
              key={t.id}
              to={`/archive/${t.id}`}
              className="archive-card card"
            >
              {t.emblem && <img src={t.emblem} alt="" className="archive-card-emblem" />}
              <div className="archive-card-info">
                <strong className="archive-card-name">{t.name}</strong>
                <span className="text-muted archive-card-season">עונה: {t.season}</span>
                {t.area && <span className="text-muted archive-card-area">{t.area}</span>}
              </div>
              <span className="archive-card-arrow">←</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default ArchivePage
