import { useState } from 'react'
import { UserPlus, ClipboardCheck, Clock } from 'lucide-react'
import MySchedule from '../components/MySchedule'
import WalkInPatientForm from '../components/WalkInPatientForm'
import CompleteRegistrationForm from '../components/CompleteRegistrationForm'
import AppointmentCheckIn from '../components/AppointmentCheckIn'
import SidebarLayout from '../components/SidebarLayout'

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin): espace accueil.
 * La creation de patient presentiel, l'enregistrement des arrivees +
 * constantes, et desormais la completion d'inscription (voir
 * CompleteRegistrationForm) sont reels.
 */
export default function DesktopReceptionistDashboard() {
  const [tab, setTab] = useState('arrivees')
  const tabs = [
    { id: 'arrivees', label: 'Arrivées du jour', icon: ClipboardCheck },
    { id: 'nouveau-patient', label: 'Nouveau patient', icon: UserPlus },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
  ]

  return (
    <SidebarLayout
      portalLabel="Portail Accueil"
      title="Espace accueil"
      subtitle="Enregistre les arrivees, prends les constantes, ou cree un patient qui se presente physiquement."
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      accentColor="bg-primary-500"
    >
      {tab === 'arrivees' && <AppointmentCheckIn />}
      {tab === 'nouveau-patient' && (
        <div className="space-y-6">
          <WalkInPatientForm />
          <CompleteRegistrationForm />
        </div>
      )}
      {tab === 'schedule' && <MySchedule />}
    </SidebarLayout>
  )
}
