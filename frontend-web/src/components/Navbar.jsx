import { Link, useNavigate } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { getRole, clearSession, getLastRoleBeforeExpiry } from '../api/client'

export default function Navbar() {
  const navigate = useNavigate()
  const role = getRole()
  const lastExpiredRole = getLastRoleBeforeExpiry()

  const effectiveRole = role || lastExpiredRole
  const isStaffRole = effectiveRole && effectiveRole !== 'patient'

  function handleLogout() {
    clearSession()
    navigate('/connexion')
  }

  return (
    <header className="border-b border-forest-100 bg-paper/95 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true"></span>
          <span className="font-display text-xl font-semibold text-forest-900">LGP Sante</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-forest-700">
          {!isStaffRole && (
            <Link to="/soins" className="hover:text-forest-900">Soins</Link>
          )}
          {role === 'patient' && (
            <>
              <Link to="/espace-patient" className="hover:text-forest-900">Mon espace</Link>
              <Link to="/messages" className="hover:text-forest-900">Messages</Link>
            </>
          )}
          {role === 'establishment_admin' && <Link to="/admin-etablissement" className="hover:text-forest-900">Mon etablissement</Link>}
          {role === 'super_admin' && <Link to="/super-admin" className="hover:text-forest-900">Super Admin</Link>}
          {role && (
            <Link to="/profil" className="text-forest-700 hover:text-forest-900" aria-label="Mon profil">
              {role && (
           <Link to="/support" className="hover:text-forest-900">Support</Link>
            )}
              <UserRound className="w-5 h-5" strokeWidth={1.75} />
            </Link>
          )}
          {!role ? (
            <Link to="/connexion" className="px-4 py-2 rounded-full bg-forest-700 text-white hover:bg-forest-900 transition">
              Connexion
            </Link>
          ) : (
            <button onClick={handleLogout} className="px-4 py-2 rounded-full border border-forest-300 hover:bg-forest-50 transition">
              Deconnexion
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
