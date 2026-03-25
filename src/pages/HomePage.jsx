import { useAuth } from '../contexts/AuthContext'
import { useTournament } from '../contexts/TournamentContext'
import LoadingSpinner from '../components/common/LoadingSpinner'
import './HomePage.css'

const HomePage = () => {
  const { userProfile } = useAuth()
  const { activeTournament, loading } = useTournament()

  if (loading) return <LoadingSpinner />

  return (
    <div className="home-page">
      <div className="home-header">
        <h1 className="home-greeting">
          שלום, {userProfile?.displayName?.split(' ')[0] || 'חבר'} 👋
        </h1>
        {activeTournament && (
          <p className="home-tournament-name">
            🏆 {activeTournament.name}
          </p>
        )}
      </div>

      {!activeTournament ? (
        <div className="card home-no-tournament">
          <p>אין טורניר פעיל כרגע</p>
          <p className="text-muted">המנהל יפתח טורניר בקרוב</p>
        </div>
      ) : (
        <div className="home-grid">
          {/* Leaderboard preview */}
          <div className="card home-widget">
            <h3>📊 מובילים</h3>
            <p className="text-muted mt-1">טעינה...</p>
          </div>

          {/* My rank */}
          <div className="card home-widget">
            <h3>🎯 הדירוג שלי</h3>
            <p className="text-muted mt-1">טעינה...</p>
          </div>

          {/* Next match */}
          <div className="card home-widget">
            <h3>⚽ המשחק הבא</h3>
            <p className="text-muted mt-1">טעינה...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage
