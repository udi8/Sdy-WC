import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { signOutUser } from '../services/firebase/auth'
import { ROUTES } from '../utils/constants'
import './PendingPage.css'

const PendingPage = () => {
  const { userProfile } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOutUser()
    navigate(ROUTES.LOGIN)
  }

  return (
    <div className="pending-page">
      <div className="pending-card card">
        <div className="pending-icon">⏳</div>
        <h2>ממתין לאישור</h2>
        <p>
          ההרשמה שלך התקבלה!
          <br />
          מנהל המערכת יאשר את גישתך בקרוב.
        </p>

        {userProfile?.email && (
          <p className="pending-email">
            <strong>{userProfile.email}</strong>
          </p>
        )}

        <p className="pending-note">
          תקבל גישה מיד לאחר שהמנהל יאשר את הבקשה.
          <br />
          ניתן לרענן את הדף לבדיקה.
        </p>

        <button className="btn btn-ghost mt-3" onClick={handleSignOut}>
          יציאה
        </button>
      </div>
    </div>
  )
}

export default PendingPage
