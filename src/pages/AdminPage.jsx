// TODO: Implement in Steps 4–6 (admin dashboard, users, tournament)
import { Link } from 'react-router-dom'
import { ROUTES } from '../utils/constants'
import './AdminPage.css'

const AdminPage = () => (
  <div className="admin-page">
    <h2>⚙️ ממשק ניהול</h2>
    <div className="admin-grid">
      <Link to={ROUTES.ADMIN_USERS} className="card admin-card">
        <span>👥</span>
        <h3>ניהול משתמשים</h3>
        <p>אישור, חסימה, שינוי תפקיד</p>
      </Link>
      <Link to={ROUTES.ADMIN_TOURNAMENT} className="card admin-card">
        <span>🏆</span>
        <h3>יצירת טורניר</h3>
        <p>חיפוש וייבוא מה-API</p>
      </Link>
      <Link to={ROUTES.ADMIN_BETS} className="card admin-card">
        <span>🎯</span>
        <h3>ניהול הימורים</h3>
        <p>הוספה, הסרה, עריכת נקודות</p>
      </Link>
      <Link to={ROUTES.ADMIN_PRIZES} className="card admin-card">
        <span>🥇</span>
        <h3>ניהול פרסים</h3>
        <p>הגדרת פרסים לטורניר</p>
      </Link>
      <Link to={ROUTES.ADMIN_STATUS} className="card admin-card">
        <span>📡</span>
        <h3>מצב מערכת</h3>
        <p>API, נעילות, שגיאות</p>
      </Link>
    </div>
  </div>
)

export default AdminPage
