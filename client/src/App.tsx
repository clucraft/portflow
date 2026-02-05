import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NewMigration from './pages/NewMigration'
import MigrationDetail from './pages/MigrationDetail'
import Users from './pages/Users'
import Scripts from './pages/Scripts'
import Reports from './pages/Reports'
import CustomerCollect from './pages/CustomerCollect'
import EstimateAccept from './pages/EstimateAccept'

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/collect/:token" element={<CustomerCollect />} />
      <Route path="/estimate/:token" element={<EstimateAccept />} />

      {/* App routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewMigration />} />
        <Route path="migrations/:id" element={<MigrationDetail />} />
        <Route path="migrations/:id/users" element={<Users />} />
        <Route path="reports" element={<Reports />} />
        <Route path="scripts" element={<Scripts />} />
      </Route>
    </Routes>
  )
}

export default App
