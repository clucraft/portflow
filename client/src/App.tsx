import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NewMigration from './pages/NewMigration'
import MigrationDetail from './pages/MigrationDetail'
import Users from './pages/Users'
import Scripts from './pages/Scripts'
import CustomerCollect from './pages/CustomerCollect'

function App() {
  return (
    <Routes>
      {/* Public route for customer data collection */}
      <Route path="/collect/:token" element={<CustomerCollect />} />

      {/* App routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewMigration />} />
        <Route path="migrations/:id" element={<MigrationDetail />} />
        <Route path="migrations/:id/users" element={<Users />} />
        <Route path="scripts" element={<Scripts />} />
      </Route>
    </Routes>
  )
}

export default App
