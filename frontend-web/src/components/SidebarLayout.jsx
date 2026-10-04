import { useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { clearSession } from '../api/client'
import logo from '../assets/logo-transparent.png'

// CORRECTIF (meme categorie de bug que celui trouve dans api/client.js):
// ce composant est utilise par TOUS les tableaux de bord du personnel,
// certains atteints UNIQUEMENT via desktop.html (Electron), d'autres
// (EstablishmentAdmin) via desktop.html OU index.html selon le contexte.
// "window.location.href = '/'" navigue toujours vers l'app PATIENT
// (index.html, via la reecriture generique de Vercel) - jamais correct
// pour un compte personnel sur Electron. Meme detection que api/client.js.
const CLIENT_TYPE = (typeof window !== 'undefined' && window.__LGP_CLIENT_TYPE__) || 'web'
const LOGOUT_REDIRECT = CLIENT_TYPE === 'desktop' ? '/desktop.html' : '/connexion'

// NOUVEAU (correctif demande par M. Faustin apres une erreur de ma part:
// j'avais invente une couleur au lieu d'adapter le catalogue existant).
// Valeurs hexadecimales EXACTES du catalogue fourni, reprises directement
// de tailwind.config.js - une seule source de verite, jamais devinees.
const ACCENT_HEX = {
  'bg-primary-700': '#0F766E',   // Patient (Teal - catalogue)
  'bg-primary-500': '#14958A',   // Hopital/Clinique (Teal clair)
  'bg-secondary-500': '#2563EB', // Medecin (Bleu - catalogue exact)
  'bg-secondary-600': '#1D4ED8', // (ancienne teinte labo, plus utilisee mais gardee au cas ou)
  'bg-secondary-900': '#1E3A8A', // Laboratoire (Bleu marine sombre - corrige, nettement distinct du medecin)
  'bg-success-700': '#15803D',   // Pharmacie (Vert, inchange - non mentionne par M. Faustin)
}

/**
 * NOUVEAU (refonte visuelle SpeedSante+, demande M. Faustin): remplace le
 * systeme d'onglets horizontaux utilise jusqu'ici par un menu lateral fixe
 * + zone de contenu a droite, conformement aux maquettes de reference
 * (portails Patient/Medecin/Pharmacie/Laboratoire/Hopital). Le comportement
 * (quel onglet est actif, quel contenu s'affiche) reste identique - seule
 * la presentation change, pour limiter le risque de regression.
 *
 * accentColor: classe Tailwind du fond de la barre laterale. Pose aussi
 * une variable CSS "--portal-accent" sur le conteneur racine, pour que
 * TOUT bouton descendant (meme dans un composant partage qui ne sait pas
 * dans quel portail il s'affiche) puisse utiliser bg-[var(--portal-accent)]
 * et heriter automatiquement la bonne couleur - demande explicite de M.
 * Faustin: "les boutons de chaque interface doivent respecter sa couleur".
 *
 * CORRIGE (meme bug mobile que PatientLayout.jsx): en dessous de "md"
 * (768px), le menu se cache et s'ouvre desormais en tiroir via un bouton
 * hamburger, au lieu de toujours occuper 256px fixes sur l'ecran - utile
 * pour EstablishmentAdmin notamment, accessible depuis le web (donc
 * potentiellement un telephone), pas seulement Electron.
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
  logoUrl,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const accentHex = ACCENT_HEX[accentColor] || ACCENT_HEX['bg-primary-700']

  function handleLogout() {
    clearSession()
    window.location.href = LOGOUT_REDIRECT
  }

  function selectTab(id) {
    onTabChange(id)
    setMobileMenuOpen(false)
  }

  return (
    <div className="flex h-screen bg-paper overflow-hidden" style={{ '--portal-accent': accentHex }}>
      <div className={`md:hidden fixed top-0 left-0 right-0 z-30 ${accentColor} text-white flex items-center justify-between px-4 py-3`}>
        <button onClick={() => setMobileMenuOpen(true)} aria-label="Ouvrir le menu">
          <Menu className="w-6 h-6" strokeWidth={1.75} />
        </button>
        <span className="font-display text-base font-semibold">{title}</span>
        <span className="w-6" aria-hidden="true"></span>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileMenuOpen(false)} aria-hidden="true"></div>
      )}

      <aside
        className={`w-64 shrink-0 ${accentColor} text-white flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <div>
            {/* NOUVEAU (demande explicite de M. Faustin: "voici le logo
                de speedsante+ que tu vas utiliser dans le systeme").
                Cadre blanc derriere le logo: certains portails ont un
                fond fonce proche des couleurs du logo lui-meme (vert
                fonce du texte "Speed" sur un fond teal), ce qui nuirait
                a la lisibilite sans ce fond neutre. */}
            <div className="bg-white rounded-lg px-3 py-2 inline-block mb-1">
              <img src={logo} alt="SpeedSanté+" className="h-7 w-auto" />
            </div>
            {portalLabel && <p className="text-xs text-white/70 uppercase tracking-wide">{portalLabel}</p>}
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden" aria-label="Fermer le menu">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition text-left ${
                activeTab === t.id ? 'bg-white/15 text-white border-r-4 border-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t.icon && <t.icon className="w-4.5 h-4.5 shrink-0" strokeWidth={1.75} />}
              <span className="flex-1">{t.label}</span>
              {/* NOUVEAU (demande M. Faustin): point/compteur reel sur un
                  element de menu, pour signaler un nombre d'elements a
                  traiter (ex: commandes en attente de verification). */}
              {t.badge > 0 && (
                <span className="bg-amber-500 text-forest-900 text-xs font-semibold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-6 py-4 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition border-t border-white/10 shrink-0"
        >
          <LogOut className="w-4.5 h-4.5" strokeWidth={1.75} />
          Déconnexion
        </button>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto pt-14 md:pt-0">
        <div className="max-w-5xl mx-auto px-8 py-10">
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-4">
              {/* NOUVEAU (demande explicite de M. Faustin: profil
                  d'etablissement avec nom + logo). */}
              {logoUrl && (
                <img src={logoUrl} alt="" className="w-14 h-14 rounded-xl object-cover border border-forest-100 shrink-0" />
              )}
              <div>
                <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
                {subtitle && <p className="text-forest-500 mt-1">{subtitle}</p>}
              </div>
            </div>
            {headerRight}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
