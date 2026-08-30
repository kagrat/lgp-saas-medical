import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Home, Calendar, Pill, FlaskConical, MessageCircle, Receipt, UserRound, LogOut } from 'lucide-react'
import { clearSession } from '../api/client'

const MENU_ITEMS = [
  { to: '/espace-patient', label: 'Accueil', icon: Home },
  { to: '/consultation', label: 'Consultation', icon: Calendar },
  { to: '/pharmacie', label: 'Pharmacie', icon: Pill },
  { to: '/laboratoire', label: 'Laboratoire', icon: FlaskConical },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/mes-factures', label: 'Mes factures', icon: Receipt },
]

/**
 * NOUVEAU (refonte visuelle SpeedSante+, demande M. Faustin): portail
 * patient avec menu lateral fixe, meme esprit que SidebarLayout.jsx (deja
 * utilise par tous les tableaux de bord du personnel) mais adapte a une
 * navigation par VRAIES ROUTES (chaque clic change de page reelle) plutot
 * que par onglets internes - le patient navigue entre plusieurs pages
 * distinctes (Consultation, Pharmacie, Laboratoire...), contrairement au
 * personnel qui reste sur un seul ecran avec du contenu qui change.
 *
 * NOTE: "Profil" reste volontairement HORS de ce menu - cette page est
 * partagee par tous les roles (patient, admin, super admin), pas
 * seulement le patient, donc elle garde sa presentation actuelle plutot
 * que d'etre dupliquee ici.
 */
export default function PatientLayout() {
  const navigate = useNavigate()

  function handleLogout() {
    clearSession()
    navigate('/connexion')
  }

  return (
    <div className="flex h-screen bg-paper overflow-hidden">
      <aside className="w-64 shrink-0 bg-primary-700 text-white flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true"></span>
            <span className="font-display text-lg font-semibold">SpeedSanté+</span>
          </div>
          <p className="text-xs text-white/70 uppercase tracking-wide">Portail Patient</p>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {MENU_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition ${
                  isActive ? 'bg-white/15 text-white border-r-4 border-amber-500' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="w-4.5 h-4.5 shrink-0" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/profil"
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition ${
                isActive ? 'bg-white/15 text-white border-r-4 border-amber-500' : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <UserRound className="w-4.5 h-4.5 shrink-0" strokeWidth={1.75} />
            Mon profil
          </NavLink>
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-6 py-4 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition border-t border-white/10 shrink-0"
        >
          <LogOut className="w-4.5 h-4.5" strokeWidth={1.75} />
          Deconnexion
        </button>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
