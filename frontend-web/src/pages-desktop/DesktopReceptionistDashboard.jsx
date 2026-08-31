import { useState } from 'react'
import { Home, UserPlus, Clock } from 'lucide-react'
import MySchedule from '../components/MySchedule'
import WalkInPatientForm from '../components/WalkInPatientForm'
import SidebarLayout from '../components/SidebarLayout'

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin): espace accueil.
 * La creation de patient presentiel est desormais reelle (voir
 * WalkInPatientForm) - l'enregistrement des arrivees et l'encaissement a
 * la sortie restent a construire dans une prochaine mise a jour.
 */
export default function DesktopReceptionistDashboard() {
  const [tab, setTab] = useState('nouveau-patient')
  const tabs = [
    { id: 'nouveau-patient', label: 'Nouveau patient', icon: UserPlus },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
  ]

  return (
    <SidebarLayout
      portalLabel="Portail Accueil"
      title="Espace accueil"
      subtitle="Enregistre un patient qui se presente physiquement, ou consulte ton planning."
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      accentColor="bg-primary-700"
    >
      {tab === 'nouveau-patient' && <WalkInPatientForm />}
      {tab === 'schedule' && <MySchedule />}
    </SidebarLayout>
  )
}
