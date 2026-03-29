import { Link } from 'react-router-dom'
import { ROUTES } from '../utils/constants'

const AdminPrizesPage = () => (
  <div className="card">
    <Link to={ROUTES.ADMIN} className="back-link">← חזור לניהול</Link>
    <h2>בקרוב</h2>
    <p className="text-muted mt-2">עמוד זה יושלם בשלבים הבאים</p>
  </div>
)
export default AdminPrizesPage
