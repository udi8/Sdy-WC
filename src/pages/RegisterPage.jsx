import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { signOutUser } from '../services/firebase/auth'
import { ROUTES, MIN_AGE, MIN_BIRTH_YEAR, MAX_BIRTH_YEAR, USER_STATUS } from '../utils/constants'
import './RegisterPage.css'

const RegisterPage = () => {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const [birthYear, setBirthYear] = useState('')
  const [loading, setLoading] = useState(false)
  const [rejected, setRejected] = useState(false)

  const currentYear = new Date().getFullYear()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!birthYear) return

    const age = currentYear - parseInt(birthYear, 10)
    setLoading(true)

    try {
      const userRef = doc(db, 'users', firebaseUser.uid)

      if (age < MIN_AGE) {
        // Under-age — block without waiting for admin
        await updateDoc(userRef, {
          birthYear: parseInt(birthYear, 10),
          status: USER_STATUS.REJECTED_UNDERAGE,
          role: 'none',
          updatedAt: serverTimestamp(),
        })
        setRejected(true)
        return
      }

      // Age OK — move to pending approval
      await updateDoc(userRef, {
        birthYear: parseInt(birthYear, 10),
        status: USER_STATUS.PENDING_APPROVAL,
        updatedAt: serverTimestamp(),
      })

      navigate(ROUTES.PENDING)
    } catch (err) {
      console.error('Register error:', err)
      alert('שגיאה בשמירה. נסה שוב.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOutUser()
    navigate(ROUTES.LOGIN)
  }

  // Generate year options (newest first)
  const years = []
  for (let y = MAX_BIRTH_YEAR; y >= MIN_BIRTH_YEAR; y--) years.push(y)

  if (rejected) {
    return (
      <div className="register-page">
        <div className="register-card card">
          <div className="register-icon">😔</div>
          <h2>מצטערים</h2>
          <p className="register-msg">
            הפלטפורמה מיועדת לגילאי {MIN_AGE} ומעלה.
            <br />לא ניתן להירשם.
          </p>
          <button className="btn btn-outline mt-3" onClick={handleSignOut}>
            חזור לדף הכניסה
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="register-page">
      <div className="register-card card">
        <div className="register-icon">📋</div>
        <h2>השלמת הרשמה</h2>
        <p className="register-subtitle">כמה פרטים קצרים לפני שמתחילים</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="birthYear">מה שנת הלידה שלך?</label>
            <select
              id="birthYear"
              className="form-control"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              required
            >
              <option value="">בחר שנה...</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading || !birthYear}
          >
            {loading ? 'שומר...' : 'המשך'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default RegisterPage
