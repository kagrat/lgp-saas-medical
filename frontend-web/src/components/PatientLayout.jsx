import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Home, Calendar, Pill, FlaskConical, MessageCircle, Receipt, UserRound, LogOut, Menu, X } from 'lucide-react'
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
 * CORRIGE (bug reel signale: sur telephone, le menu fixe de 256px
 * prenait une part disproportionnee de l'ecran, au point de rendre le
 * contenu de droite quasi invisible). En dessous du breakpoint "md"
 * (768px), le menu est desormais cache par defaut et s'ouvre en tiroir
 * coulissant via un bouton hamburger - le contenu prend toute la largeur
 * disponible. Au-dessus de "md", comportement inchange (menu toujours
 * visible, fixe a gauche).
 *
 * NOTE: "Profil" reste volontairement HORS de ce menu - cette page est
 * partagee par tous les roles (patient, admin, super admin), pas
 * seulement le patient, donc elle garde sa presentation actuelle plutot
 * que d'etre dupliquee ici.
 */
export default function PatientLayout() {
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
      {/* NOUVEAU: barre mobile avec bouton hamburger, visible uniquement
          en dessous du breakpoint "md" - remplace le menu fixe qui
          prenait trop de place sur telephone. */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-primary-700 text-white flex items-center justify-between px-4 py-3">
        <button onClick={() => setMobileMenuOpen(true)} aria-label="Ouvrir le menu">
          <Menu className="w-6 h-6" strokeWidth={1.75} />
        </button>
        <span className="font-display text-base font-semibold">{currentItem ? currentItem.label : 'SpeedSanté+'}</span>
        <span className="w-6" aria-hidden="true"></span>
      </div>

      {/* NOUVEAU: fond assombri derriere le tiroir mobile, cliquer dessus le ferme */}
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
            onClick={closeMobileMenu}
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

      <main className="flex-1 min-w-0 overflow-y-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
