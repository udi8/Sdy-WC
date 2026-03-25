import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ROUTES, USER_STATUS } from '../../utils/constants'
import LoadingSpinner from '../common/LoadingSpinner'

/**
 * Wraps routes that require authentication and optionally admin role.
 */
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { firebaseUser, userProfile, isLoading, isAdmin, isApproved } = useAuth()

  if (isLoading) return <LoadingSpinner fullPage />

  // Not logged in
  if (!firebaseUser) return <Navigate to={ROUTES.LOGIN} replace />

  // Logged in but profile not yet created (rare edge case)
  if (!userProfile) return <LoadingSpinner fullPage />

  // Needs to complete age verification
  if (userProfile.status === USER_STATUS.PENDING_AGE)
    return <Navigate to={ROUTES.REGISTER} replace />

  // Waiting for admin approval
  if (userProfile.status === USER_STATUS.PENDING_APPROVAL)
    return <Navigate to={ROUTES.PENDING} replace />

  // Blocked or underage
  if (
    userProfile.status === USER_STATUS.BLOCKED ||
    userProfile.status === USER_STATUS.REJECTED_UNDERAGE
  )
    return <Navigate to={ROUTES.LOGIN} replace />

  // Admin-only routes
  if (requireAdmin && !isAdmin)
    return <Navigate to={ROUTES.HOME} replace />

  // Not yet approved
  if (!isApproved) return <Navigate to={ROUTES.PENDING} replace />

  return children
}

export default ProtectedRoute
