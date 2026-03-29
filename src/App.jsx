import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { AuthProvider } from './contexts/AuthContext'
import { TournamentProvider } from './contexts/TournamentContext'

import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'

import AdminBootstrapPage from './pages/AdminBootstrapPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PendingPage from './pages/PendingPage'
import HomePage from './pages/HomePage'
import MyBetsPage from './pages/MyBetsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import StatsPage from './pages/StatsPage'
import LivePage from './pages/LivePage'
import AdminPage from './pages/AdminPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminTournamentPage from './pages/AdminTournamentPage'
import AdminBetsPage from './pages/AdminBetsPage'
import AdminPrizesPage from './pages/AdminPrizesPage'
import AdminStatusPage from './pages/AdminStatusPage'
import ArchivePage from './pages/ArchivePage'
import ArchiveViewPage from './pages/ArchiveViewPage'

import { ROUTES } from './utils/constants'

const App = () => (
  <AuthProvider>
    <TournamentProvider>
      <Routes>
        {/* ── Public routes (no layout) ── */}
        <Route path={ROUTES.LOGIN}    element={<LoginPage />} />
        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
        <Route path={ROUTES.PENDING}  element={<PendingPage />} />
        <Route path={ROUTES.LIVE}     element={<LivePage />} />
        <Route path="/admin-setup"    element={<AdminBootstrapPage />} />

        {/* ── Protected member routes (with navbar) ── */}
        <Route
          path={ROUTES.HOME}
          element={
            <ProtectedRoute>
              <Layout><HomePage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.MY_BETS}
          element={
            <ProtectedRoute>
              <Layout><MyBetsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.LEADERBOARD}
          element={
            <ProtectedRoute>
              <Layout><LeaderboardPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.STATS}
          element={
            <ProtectedRoute>
              <Layout><StatsPage /></Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Admin routes ── */}
        <Route
          path={ROUTES.ADMIN}
          element={
            <ProtectedRoute requireAdmin>
              <Layout><AdminPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN_USERS}
          element={
            <ProtectedRoute requireAdmin>
              <Layout><AdminUsersPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN_TOURNAMENT}
          element={
            <ProtectedRoute requireAdmin>
              <Layout><AdminTournamentPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN_BETS}
          element={
            <ProtectedRoute requireAdmin>
              <Layout><AdminBetsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN_PRIZES}
          element={
            <ProtectedRoute requireAdmin>
              <Layout><AdminPrizesPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN_STATUS}
          element={
            <ProtectedRoute requireAdmin>
              <Layout><AdminStatusPage /></Layout>
            </ProtectedRoute>
          }
        />

        {/* Archive */}
        <Route
          path={ROUTES.ARCHIVE}
          element={
            <ProtectedRoute>
              <Layout><ArchivePage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ARCHIVE_VIEW}
          element={
            <ProtectedRoute>
              <Layout><ArchiveViewPage /></Layout>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>

      <ToastContainer
        position="top-center"
        autoClose={3000}
        rtl
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        draggable
      />
    </TournamentProvider>
  </AuthProvider>
)

export default App
