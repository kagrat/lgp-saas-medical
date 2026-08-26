import { getRole } from '../api/client'

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin): espace d'attente
 * honnete pour les roles dont le compte existe deja mais dont les outils
 * dedies ne sont pas encore construits (hospitalisation pour l'infirmier,
 * facturation pour le comptable, accueil pour le receptionniste - chantiers
 * a venir dans les prochaines phases). Mieux vaut un message clair que
 * rien du tout ou une fausse fonctionnalite.
 */
const COPY = {
  nurse: {
    title: 'Espace infirmier(ere)',
    body: "Ton compte est actif. Le suivi des patients hospitalises (constantes vitales, notes de soins, tournees) arrive dans une prochaine mise a jour de la plateforme.",
  },
  receptionist: {
    title: "Espace accueil",
    body: "Ton compte est actif. L'enregistrement des arrivees patients et l'encaissement a la sortie arrivent dans une prochaine mise a jour de la plateforme.",
  },
  accountant: {
    title: 'Espace comptabilite',
    body: "Ton compte est actif. La facturation reelle (factures, encaissements, suivi des impayes) arrive dans une prochaine mise a jour de la plateforme.",
  },
}

export default function DesktopComingSoonDashboard() {
  const role = getRole()
  const copy = COPY[role] || { title: 'Ton espace', body: "Les outils dedies a ton role arrivent prochainement." }

  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">{copy.title}</p>
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-4">Bienvenue</h1>
      <p className="text-forest-700">{copy.body}</p>
      <p className="text-sm text-forest-500 mt-6">
        En attendant, ton profil est accessible depuis le menu "Mon profil" en haut de l'ecran.
      </p>
    </div>
  )
}
