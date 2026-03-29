import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTournament } from '../../contexts/TournamentContext'
import { signOutUser } from '../../services/firebase/auth'
import { ROUTES } from '../../utils/constants'
import './Navbar.css'

const Navbar = () => {
  const { userProfile, isAdmin, isApproved } = useAuth()
  const { finishedTournaments } = useTournament()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const toggleMenu = () => setMenuOpen((prev) => !prev)
  const closeMenu = () => setMenuOpen(false)

  const handleSignOut = async () => {
    await signOutUser()
    closeMenu()
  }

  const isActive = (path) => location.pathname === path ? 'active' : ''

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        {/* Replace with actual kibbutz logo */}
        <div className="navbar-logo-placeholder">🏆</div>
        <span className="navbar-title">ניחושי ספורט</span>
      </div>

      {/* Hamburger for mobile */}
      <button
        className="hamburger"
        onClick={toggleMenu}
        aria-label="תפריט"
        aria-expanded={menuOpen}
      >
        <span />
        <span />
        <span />
      </button>

      <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        <li>
          <Link to={ROUTES.HOME} className={isActive(ROUTES.HOME)} onClick={closeMenu}>
            🏠 בית
          </Link>
        </li>

        {isApproved && (
          <>
            <li>
              <Link to={ROUTES.MY_BETS} className={isActive(ROUTES.MY_BETS)} onClick={closeMenu}>
                🎯 הניחושים שלי
              </Link>
            </li>
            <li>
              <Link to={ROUTES.LEADERBOARD} className={isActive(ROUTES.LEADERBOARD)} onClick={closeMenu}>
                📊 טבלת מובילים
              </Link>
            </li>
            <li>
              <Link to={ROUTES.STATS} className={isActive(ROUTES.STATS)} onClick={closeMenu}>
                📈 סטטיסטיקות
              </Link>
            </li>
            {finishedTournaments.length > 0 && (
              <li>
                <Link to={ROUTES.ARCHIVE} className={isActive(ROUTES.ARCHIVE)} onClick={closeMenu}>
                  📦 ארכיון
                </Link>
              </li>
            )}
          </>
        )}

        {isAdmin && (
          <li>
            <Link to={ROUTES.ADMIN} className={isActive(ROUTES.ADMIN)} onClick={closeMenu}>
              ⚙️ ניהול
            </Link>
          </li>
        )}

        <li>
          <Link to={ROUTES.LIVE} className={isActive(ROUTES.LIVE)} onClick={closeMenu}>
            📺 מסך חי
          </Link>
        </li>

        {userProfile ? (
          <li className="navbar-user">
            <img
              src={userProfile.photoURL || '/default-avatar.png'}
              alt={userProfile.displayName}
              className="navbar-avatar"
            />
            <span className="navbar-username">{userProfile.displayName?.split(' ')[0]}</span>
            <button className="btn-signout" onClick={handleSignOut}>
              יציאה
            </button>
          </li>
        ) : (
          <li>
            <Link to={ROUTES.LOGIN} onClick={closeMenu}>כניסה</Link>
          </li>
        )}
      </ul>
    </nav>
  )
}

export default Navbar
