import { LogOut } from 'lucide-react'
import { clearSession } from '../api/client'

// CORRECTIF (meme categorie de bug que celui trouve dans api/client.js):
// ce composant est utilise par TOUS les tableaux de bord du personnel,
// certains atteints UNIQUEMENT via desktop.html (Electron), d'autres
// (EstablishmentAdmin) via desktop.html OU index.html selon le contexte.
// "window.location.href = '/'" navigue toujours vers l'app PATIENT
// (index.html, via la reecriture generique de Vercel) - jamais correct
// pour un compte personnel sur Electron. Meme detection que api/client.js.
const CLIENT_TYPE = (typeof window !== 'undefined' && window.__LGP_CLIENT_TYPE__) || 'web'
const LOGOUT_REDIRECT = CLIENT_TYPE === 'desktop' ? '/desktop.html' : '/connexion'

/**
 * NOUVEAU (refonte visuelle SpeedSante+, demande M. Faustin): remplace le
 * systeme d'onglets horizontaux utilise jusqu'ici par un menu lateral fixe
 * + zone de contenu a droite, conformement aux maquettes de reference
 * (portails Patient/Medecin/Pharmacie/Laboratoire/Hopital). Le comportement
 * (quel onglet est actif, quel contenu s'affiche) reste identique - seule
 * la presentation change, pour limiter le risque de regression.
 *
 * accentColor: classe Tailwind du fond de la barre laterale, alignee sur
 * le code couleur par portail des maquettes (teal pour patient/hopital,
 * bleu pour medecin/laboratoire, vert pour pharmacie).
 */
export default function SidebarLayout({
  portalLabel,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  headerRight,
  accentColor = 'bg-primary-700',
  children,
}) {
  function handleLogout() {
    clearSession()
    window.location.href = LOGOUT_REDIRECT
  }

  return (
    <div className="flex h-screen bg-paper overflow-hidden">
      <aside className={`w-64 shrink-0 ${accentColor} text-white flex flex-col`}>
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true"></span>
            <span className="font-display text-lg font-semibold">SpeedSanté+</span>
          </div>
          {portalLabel && <p className="text-xs text-white/70 uppercase tracking-wide">{portalLabel}</p>}
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition text-left ${
                activeTab === t.id ? 'bg-white/15 text-white border-r-4 border-amber-500' : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t.icon && <t.icon className="w-4.5 h-4.5 shrink-0" strokeWidth={1.75} />}
              {t.label}
            </button>
          ))}
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
        <div className="max-w-5xl mx-auto px-8 py-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
              {subtitle && <p className="text-forest-500 mt-1">{subtitle}</p>}
            </div>
            {headerRight}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
