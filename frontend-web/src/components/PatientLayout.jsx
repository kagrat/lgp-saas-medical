import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Home, Calendar, CalendarPlus, Pill, FlaskConical, Microscope, MessageCircle, Receipt, UserRound, LogOut, Menu, X, FileText, ClipboardList } from 'lucide-react'
import { clearSession } from '../api/client'

const MENU_ITEMS = [
  { to: '/espace-patient', label: 'Accueil', icon: Home },
  { to: '/mes-rendez-vous', label: 'Mes rendez-vous', icon: Calendar },
  { to: '/mon-dossier', label: 'Mon dossier patient', icon: FileText },
  { to: '/mes-analyses', label: 'Mes analyses', icon: FlaskConical },
  { to: '/mes-ordonnances', label: 'Mes ordonnances', icon: ClipboardList },
  { to: '/consultation', label: 'Consultation', icon: CalendarPlus },
  { to: '/pharmacie', label: 'Pharmacie', icon: Pill },
  { to: '/laboratoire', label: 'Laboratoire', icon: Microscope },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/mes-factures', label: 'Mes factures', icon: Receipt },
]

/**
 * NOUVEAU (corrige une incoherence visuelle signalee): chrome du menu
 * lateral patient extrait en composant reutilisable independant du
 * routage (accepte des "children" plutot que de toujours utiliser
 * <Outlet/>). Permet a Profile.jsx de s'en servir aussi pour "Mon profil"
 * - avant ce correctif, cette page (partagee par tous les roles) faisait
 * quitter temporairement le menu lateral pour l'ancienne barre du haut,
 * ce qui donnait une impression d'aller-retour incoherente.
 */
export function PatientSidebarChrome({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleLogout() {
    clearSession()
    navigate('/connexion')
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  const currentItem = MENU_ITEMS.find((item) => item.to === location.pathname)

  return (
    <div className="flex h-screen bg-paper overflow-hidden">
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-primary-700 text-white flex items-center justify-between px-4 py-3">
        <button onClick={() => setMobileMenuOpen(true)} aria-label="Ouvrir le menu">
          <Menu className="w-6 h-6" strokeWidth={1.75} />
        </button>
        <span className="font-display text-base font-semibold">{currentItem ? currentItem.label : 'Mon profil'}</span>
        <span className="w-6" aria-hidden="true"></span>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={closeMobileMenu} aria-hidden="true"></div>
      )}

      <aside
        className={`w-64 shrink-0 bg-primary-700 text-white flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true"></span>
              <span className="font-display text-lg font-semibold">SpeedSanté+</span>
            </div>
            <p className="text-xs text-white/70 uppercase tracking-wide">Portail Patient</p>
          </div>
          <button onClick={closeMobileMenu} className="md:hidden" aria-label="Fermer le menu">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {MENU_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition ${
                  isActive ? 'bg-white/15 text-white border-r-4 border-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="w-4.5 h-4.5 shrink-0" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/profil"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition ${
                isActive ? 'bg-white/15 text-white border-r-4 border-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
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

      <main className="flex-1 min-w-0 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}

/**
 * Wrapper de routage (layout route): utilise PatientSidebarChrome avec
 * <Outlet/> pour le contenu qui change selon la page visitee.
 */
export default function PatientLayout() {
  return (
    <PatientSidebarChrome>
      <Outlet />
    </PatientSidebarChrome>
  )
}
