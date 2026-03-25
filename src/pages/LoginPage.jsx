import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { signInWithGoogle, createUserProfile } from '../services/firebase/auth'
import { ROUTES, USER_STATUS } from '../utils/constants'
import LoadingSpinner from '../components/common/LoadingSpinner'
import './LoginPage.css'

const LoginPage = () => {
  const { firebaseUser, userProfile, isLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (isLoading || !firebaseUser || !userProfile) return

    if (userProfile.status === USER_STATUS.PENDING_AGE)    return navigate(ROUTES.REGISTER)
    if (userProfile.status === USER_STATUS.PENDING_APPROVAL) return navigate(ROUTES.PENDING)
    if (userProfile.status === USER_STATUS.ACTIVE)         return navigate(ROUTES.HOME)
  }, [firebaseUser, userProfile, isLoading, navigate])

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle()
      // createUserProfile won't overwrite existing doc
      await createUserProfile(result.user)
      // AuthContext listener will fire and redirect automatically
    } catch (err) {
      console.error('Sign-in error:', err)
      alert('שגיאה בכניסה. אנא נסה שוב.')
    }
  }

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <div className="login-page">
      <div className="login-card card">
        {/* Kibbutz logo placeholder */}
        <div className="login-logo">🏆</div>
        <h1 className="login-title">ניחושי ספורט</h1>
        <p className="login-subtitle">הכנס עם חשבון Gmail שלך</p>

        <button className="btn-google" onClick={handleGoogleSignIn}>
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            width={20}
            height={20}
          />
          המשך עם Google
        </button>

        <p className="login-note">
          הכניסה לפלטפורמה מחייבת אישור מנהל לאחר ההרשמה
        </p>
      </div>
    </div>
  )
}

export default LoginPage
