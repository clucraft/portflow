import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, FileCode, Phone, Zap } from 'lucide-react'
import ParticleBackground from './ParticleBackground'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Scripts', href: '/scripts', icon: FileCode },
]

export default function Layout() {
  return (
    <div className="min-h-screen flex relative">
      {/* Particle Background */}
      <ParticleBackground />

      {/* Sidebar */}
      <div className="w-64 bg-surface-800/90 backdrop-blur-sm border-r border-surface-600 flex flex-col relative z-10">
        <div className="p-4 border-b border-surface-600">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Phone className="h-8 w-8 text-primary-400" />
              <Zap className="h-3 w-3 text-primary-300 absolute -top-1 -right-1" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-400 text-glow">PortFlow</h1>
              <p className="text-xs text-zinc-500 tracking-wider">EV MIGRATION MANAGER</p>
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
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30 glow-primary'
                    : 'text-zinc-400 hover:bg-surface-700 hover:text-zinc-200 border border-transparent'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="tracking-wide">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-600">
          <div className="text-xs text-zinc-600 tracking-widest uppercase">
            Enterprise Voice
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Teams Migration System
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col relative z-10">
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
