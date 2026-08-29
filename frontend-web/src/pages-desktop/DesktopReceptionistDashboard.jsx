import { useState } from 'react'
import { Home } from 'lucide-react'
import MySchedule from '../components/MySchedule'
import SidebarLayout from '../components/SidebarLayout'

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin): espace accueil -
 * remplace partiellement le placeholder "en construction". L'enregistrement
 * des arrivees patients et l'encaissement a la sortie restent a construire
 * (chantier reception dedie) - en attendant, le receptionniste voit au
 * moins son propre planning et peut demander un conge, comme tout le
 * personnel.
 */
export default function DesktopReceptionistDashboard() {
  const [tab, setTab] = useState('accueil')
  const tabs = [{ id: 'accueil', label: 'Accueil', icon: Home }]

  return (
    <SidebarLayout
      portalLabel="Portail Accueil"
      title="Espace accueil"
      subtitle="L'enregistrement des arrivees patients et l'encaissement arrivent dans une prochaine mise a jour."
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      accentColor="bg-primary-700"
    >
      <MySchedule />
    </SidebarLayout>
  )
}
