import { useState } from 'react'
import { Home } from 'lucide-react'
import { getRole } from '../api/client'
import SidebarLayout from './../components/SidebarLayout'

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
    title: 'Espace infirmier(ère)',
    body: "Ton compte est actif. Le suivi des patients hospitalisés (constantes vitales, notes de soins, tournées) arrive dans une prochaine mise à jour de la plateforme.",
  },
  receptionist: {
    title: "Espace accueil",
    body: "Ton compte est actif. L'enregistrement des arrivées de patients et l'encaissement à la sortie arrivent dans une prochaine mise à jour de la plateforme.",
  },
  accountant: {
    title: 'Espace comptabilité',
    body: "Ton compte est actif. La facturation réelle (factures, encaissements, suivi des impayés) arrive dans une prochaine mise à jour de la plateforme.",
  },
}

export default function DesktopComingSoonDashboard() {
  const role = getRole()
  const copy = COPY[role] || { title: 'Ton espace', body: "Les outils dédiés à ton rôle arrivent prochainement." }
  const [tab, setTab] = useState('accueil')
  const tabs = [{ id: 'accueil', label: 'Accueil', icon: Home }]

  return (
    <SidebarLayout
      portalLabel={copy.title}
      title="Bienvenue"
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      accentColor="bg-primary-500"
    >
      <div className="max-w-xl">
        <p className="text-forest-700">{copy.body}</p>
        <p className="text-sm text-forest-500 mt-6">
          En attendant, ton profil est accessible depuis le menu "Mon profil" en haut de l'écran.
        </p>
      </div>
    </SidebarLayout>
  )
}
