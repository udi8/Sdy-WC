import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase/config'
import { approveUser, blockUser, setAdminRole } from '../services/firebase/users'
import { toast } from 'react-toastify'
import './AdminUsersPage.css'

const STATUS_LABELS = {
  pending_age:       { label: 'ממתין גיל',   cls: 'badge-warning' },
  pending_approval:  { label: 'ממתין אישור', cls: 'badge-info'    },
  active:            { label: 'פעיל',         cls: 'badge-success' },
  blocked:           { label: 'חסום',         cls: 'badge-danger'  },
  rejected_underage: { label: 'נדחה — גיל',  cls: 'badge-danger'  },
}

const ROLE_LABELS = {
  admin:   { label: 'מנהל',  cls: 'badge-danger'  },
  member:  { label: 'חבר',   cls: 'badge-success' },
  pending: { label: 'ממתין', cls: 'badge-warning' },
  none:    { label: 'ללא',   cls: 'badge-muted'   },
}

const FILTERS = [
  { key: 'all',             label: 'כולם'    },
  { key: 'pending_approval', label: 'ממתינים' },
  { key: 'active',           label: 'פעילים'  },
  { key: 'blocked',          label: 'חסומים'  },
]

const calcAge = (birthYear) =>
  birthYear ? new Date().getFullYear() - birthYear : null

const AdminUsersPage = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  const handleAction = async (uid, action, label) => {
    setActionLoading(uid)
    try {
      await action(uid)
      toast.success(`בוצע: ${label}`)
    } catch (err) {
      console.error(err)
      toast.error('שגיאה, נסה שוב')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = users.filter((u) => {
    const matchFilter = filter === 'all' || u.status === filter
    const matchSearch =
      !search ||
      u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const pendingCount = users.filter((u) => u.status === 'pending_approval').length

  return (
    <div className="admin-users-page">
      <div className="admin-users-header">
        <h2>👥 ניהול משתמשים</h2>
        {pendingCount > 0 && (
          <span className="badge badge-warning">{pendingCount} ממתינים לאישור</span>
        )}
      </div>

      <input
        type="text"
        className="form-control admin-search"
        placeholder="חיפוש לפי שם או אימייל..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="admin-users-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`tab-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key === 'pending_approval' && pendingCount > 0 && (
              <span className="tab-badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted mt-2">טוען...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted mt-2">אין משתמשים</p>
      ) : (
        <div className="users-list">
          {filtered.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isLoading={actionLoading === user.id}
              onApprove={() => handleAction(user.id, approveUser, 'אושר')}
              onBlock={() => handleAction(user.id, blockUser, 'נחסם')}
              onMakeAdmin={() => handleAction(user.id, setAdminRole, 'הפך למנהל')}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const UserRow = ({ user, isLoading, onApprove, onBlock, onMakeAdmin }) => {
  const age = calcAge(user.birthYear)
  const statusInfo = STATUS_LABELS[user.status] || { label: user.status, cls: 'badge-muted' }
  const roleInfo   = ROLE_LABELS[user.role]     || { label: user.role,   cls: 'badge-muted' }

  return (
    <div className={`user-row card ${user.status === 'pending_approval' ? 'user-row-pending' : ''}`}>
      <div className="user-row-main">
        <div className="user-info">
          <img
            src={user.photoURL || ''}
            alt={user.displayName}
            className="user-avatar"
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || '?')}&background=1a3a5c&color=fff`
            }}
          />
          <div className="user-details">
            <strong className="user-name">{user.displayName || '—'}</strong>
            <span className="user-email">{user.email}</span>
            <div className="user-meta">
              {user.birthYear && (
                <span className="user-age">🎂 {user.birthYear} ({age} שנים)</span>
              )}
              {user.createdAt && (
                <span className="user-joined">
                  נרשם: {user.createdAt.toDate?.()?.toLocaleDateString('he-IL') ?? '—'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="user-badges">
          <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
          <span className={`badge ${roleInfo.cls}`}>{roleInfo.label}</span>
        </div>
      </div>

      <div className="user-actions">
        {user.status === 'pending_approval' && (
          <button className="btn btn-primary" onClick={onApprove} disabled={isLoading}>
            ✅ אשר
          </button>
        )}
        {user.status === 'active' && user.role !== 'admin' && (
          <>
            <button className="btn btn-outline" onClick={onMakeAdmin} disabled={isLoading}>
              ⚙️ הפוך למנהל
            </button>
            <button className="btn btn-danger" onClick={onBlock} disabled={isLoading}>
              🚫 חסום
            </button>
          </>
        )}
        {user.status === 'blocked' && (
          <button className="btn btn-primary" onClick={onApprove} disabled={isLoading}>
            🔓 בטל חסימה
          </button>
        )}
        {isLoading && <span className="text-muted">שומר...</span>}
      </div>
    </div>
  )
}

export default AdminUsersPage
