import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NewMigration from './pages/NewMigration'
import MigrationDetail from './pages/MigrationDetail'
import Users from './pages/Users'
import Scripts from './pages/Scripts'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Setup from './pages/Setup'
import CustomerCollect from './pages/CustomerCollect'
import EstimateAccept from './pages/EstimateAccept'
import CustomerQuestionnaire from './pages/CustomerQuestionnaire'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/collect/:token" element={<CustomerCollect />} />
        <Route path="/estimate/:token" element={<EstimateAccept />} />
        <Route path="/questionnaire/:token" element={<CustomerQuestionnaire />} />

        {/* App routes (protected) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="new" element={<NewMigration />} />
          <Route path="migrations/:id" element={<MigrationDetail />} />
          <Route path="migrations/:id/users" element={<Users />} />
          <Route path="reports" element={<Reports />} />
          <Route path="scripts" element={<Scripts />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
