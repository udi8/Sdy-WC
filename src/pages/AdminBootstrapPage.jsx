import { useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-toastify'
import './AdminBootstrapPage.css'

/**
 * One-time setup page — makes the current logged-in user an admin.
 * Only accessible at /admin-setup.
 * After the first admin is created, this page should be removed or secured.
 */
const AdminBootstrapPage = () => {
  const { firebaseUser, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!firebaseUser) {
    return (
      <div className="bootstrap-page">
        <div className="card bootstrap-card">
          <p>יש להתחבר קודם עם Google</p>
        </div>
      </div>
    )
  }

  if (userProfile?.role === 'admin') {
    return (
      <div className="bootstrap-page">
        <div className="card bootstrap-card">
          <div className="bootstrap-icon">✅</div>
          <h2>אתה כבר מנהל!</h2>
          <p className="text-muted">המשך ל<a href="/admin">ממשק הניהול</a></p>
        </div>
      </div>
    )
  }

  const handleMakeAdmin = async () => {
    setLoading(true)
    try {
      const userRef = doc(db, 'users', firebaseUser.uid)
      await setDoc(
        userRef,
        {
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          role: 'admin',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      setDone(true)
      toast.success('הפכת למנהל! רענן את הדף.')
    } catch (err) {
      console.error(err)
      toast.error('שגיאה: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bootstrap-page">
      <div className="card bootstrap-card">
        <div className="bootstrap-icon">🔑</div>
        <h2>הגדרת מנהל ראשון</h2>
        <p className="text-muted">
          פעולה זו תגדיר אותך כמנהל המערכת.
          <br />בצע פעולה זו פעם אחת בלבד.
        </p>

        {done ? (
          <div className="bootstrap-success">
            <p>✅ הצלחה! עכשיו <a href="/">רענן את הדף</a></p>
          </div>
        ) : (
          <>
            <div className="bootstrap-user-info">
              <img
                src={firebaseUser.photoURL}
                alt={firebaseUser.displayName}
                className="bootstrap-avatar"
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <div>
                <strong>{firebaseUser.displayName}</strong>
                <p className="text-muted">{firebaseUser.email}</p>
              </div>
            </div>

            <button
              className="btn btn-primary w-full"
              onClick={handleMakeAdmin}
              disabled={loading}
            >
              {loading ? 'מגדיר...' : '🔑 הגדר כמנהל'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default AdminBootstrapPage
