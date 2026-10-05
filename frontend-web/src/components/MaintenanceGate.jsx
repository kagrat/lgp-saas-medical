import { useEffect } from 'react'
import { Lock } from 'lucide-react'
import logo from '../assets/logo-transparent.png'

/**
 * NOUVEAU (demande de l'integrateur): interrupteur de SUSPENSION D'ACCES.
 *
 * Quand il est actif, TOUTE l'application est remplacee par une page claire
 * ("Acces temporairement suspendu") - rien d'autre n'est monte, donc aucune
 * requete n'est envoyee au serveur. Le site web ET l'application desktop
 * (qui charge son interface depuis le meme site) affichent la meme page.
 *
 * ACTIVATION (aucune modification de code):
 *   Vercel -> Settings -> Environment Variables -> VITE_MAINTENANCE_MODE = true
 *   puis Deployments -> Redeploy. Pour retablir: repasser a false et redeployer.
 *   (Une variable Vite est integree a la compilation: il faut donc un
 *   redeploiement, environ 1 a 2 minutes - le changement n'est pas instantane.)
 *
 * MESSAGE: VITE_MAINTENANCE_MESSAGE (optionnel) remplace le texte par defaut.
 *
 * APERCU SANS RISQUE: ajouter ?apercu-maintenance=1 a l'adresse affiche la
 * page meme quand le mode est eteint (ex: .../?apercu-maintenance=1 ou
 * .../desktop.html?apercu-maintenance=1). Cela ne bloque personne.
 *
 * LIMITE ASSUMEE: c'est un blocage d'INTERFACE, pas un controle de securite.
 * Il empeche l'usage normal du site et de l'application, mais ne coupe pas le
 * serveur (Railway) lui-meme, et un onglet deja ouvert continue de fonctionner
 * jusqu'a son rechargement.
 */
const DEFAULT_MESSAGE =
  "Cet espace est momentanément indisponible. Pour rétablir l'accès, merci de contacter l'équipe SpeedSanté+."

export function isMaintenanceActive() {
  const flag = String(import.meta.env.VITE_MAINTENANCE_MODE || '').trim().toLowerCase() === 'true'
  const preview =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('apercu-maintenance')
  return flag || preview
}

function MaintenancePage() {
  const message = String(import.meta.env.VITE_MAINTENANCE_MESSAGE || '').trim() || DEFAULT_MESSAGE

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'SpeedSanté+ - Accès suspendu'
    // Cette page n'a aucune raison d'etre indexee par les moteurs de recherche.
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    document.head.appendChild(robots)
    return () => {
      document.title = previousTitle
      robots.remove()
    }
  }, [])

  return (
    <main className="min-h-screen bg-primary-900 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <div className="inline-block bg-white rounded-xl px-5 py-3 mb-8">
          <img src={logo} alt="SpeedSanté+" className="h-11 w-auto" />
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-lg" role="status">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <Lock className="h-7 w-7 text-primary-700" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-forest-900 mb-3">
            Accès temporairement suspendu
          </h1>
          <p className="text-forest-700 leading-relaxed">{message}</p>
        </div>
        <p className="mt-6 text-xs text-white/60">SpeedSanté+ - Votre santé, simplement.</p>
      </div>
    </main>
  )
}

export default function MaintenanceGate({ children }) {
  if (!isMaintenanceActive()) return children
  return <MaintenancePage />
}
