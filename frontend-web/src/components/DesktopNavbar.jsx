import { useNavigate } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { getRole, clearSession } from '../api/client'
import { Link } from 'react-router-dom'

export default function DesktopNavbar() {
  const navigate = useNavigate()
  const role = getRole()

  function handleLogout() {
    clearSession()
    navigate('/')
  }

  if (!role) return null

  return (
    <header className="border-b border-forest-100 bg-forest-900">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true"></span>
          <span className="font-display text-lg font-semibold text-white">LGP Console</span>
        </div>
        <nav className="flex items-center gap-5 text-sm font-medium text-forest-100">
          {role === 'establishment_admin' && <Link to="/admin-etablissement" className="hover:text-white">Mon etablissement</Link>}
          {role === 'super_admin' && <Link to="/super-admin" className="hover:text-white">Super Admin</Link>}
          <Link to="/support" className="hover:text-white">Support</Link>
          <Link to="/profil" className="hover:text-white" aria-label="Mon profil">
            <UserRound className="w-5 h-5" strokeWidth={1.75} />
          </Link>
          <button onClick={handleLogout} className="px-4 py-1.5 rounded-full border border-forest-300 text-white hover:bg-forest-700 transition">
            Deconnexion
          </button>
        </nav>
      </div>
    </header>
  )
}
