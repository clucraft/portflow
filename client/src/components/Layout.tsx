import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Plus, FileCode, Phone } from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'New Migration', href: '/new', icon: Plus },
  { name: 'Scripts', href: '/scripts', icon: FileCode },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Phone className="h-8 w-8 text-primary-400" />
            <div>
              <h1 className="text-xl font-bold">PortFlow</h1>
              <p className="text-xs text-gray-400">EV Migration Manager</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 text-xs text-gray-500">
          Enterprise Voice Migrations
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-gray-50">
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
