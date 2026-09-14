import { useState } from 'react'
import { UserPlus, ClipboardCheck, Clock, CalendarPlus, MessageCircle, MessageSquare } from 'lucide-react'
import MySchedule from '../components/MySchedule'
import WalkInPatientForm from '../components/WalkInPatientForm'
import CompleteRegistrationForm from '../components/CompleteRegistrationForm'
import AppointmentCheckIn from '../components/AppointmentCheckIn'
import ReceptionBookAppointment from '../components/ReceptionBookAppointment'
import SidebarLayout from '../components/SidebarLayout'
import InternalMessaging from '../components/InternalMessaging'
import PatientMessaging from '../components/PatientMessaging'
import NotificationBell from '../components/NotificationBell'
import UserProfileBadge from '../components/UserProfileBadge'

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin): espace accueil.
 * La creation de patient presentiel, l'enregistrement des arrivees +
 * constantes, la completion d'inscription, et desormais la prise de
 * rendez-vous pour un patient present (voir ReceptionBookAppointment)
 * sont reels.
 */
export default function DesktopReceptionistDashboard() {
  const [tab, setTab] = useState('arrivees')
  const tabs = [
    { id: 'arrivees', label: 'Arrivées du jour', icon: ClipboardCheck },
    { id: 'nouveau-patient', label: 'Nouveau patient', icon: UserPlus },
    { id: 'rendez-vous', label: 'Prendre rendez-vous', icon: CalendarPlus },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
    // NOUVEAU (audit complet: manquait completement, corrige - le
    // personnel d'accueil doit pouvoir echanger avec les medecins).
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'internal-messages', label: 'Messagerie interne', icon: MessageCircle },
  ]

  return (
    <SidebarLayout
      portalLabel="Portail Accueil"
      title="Espace accueil"
      subtitle="Enregistre les arrivees, prends les constantes, cree un patient, ou prends-lui rendez-vous."
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      accentColor="bg-primary-500"
      headerRight={<div className="flex items-center gap-4"><NotificationBell /><UserProfileBadge /></div>}
    >
      {tab === 'arrivees' && <AppointmentCheckIn />}
      {tab === 'nouveau-patient' && (
        <div className="space-y-6">
          <WalkInPatientForm />
          <CompleteRegistrationForm />
        </div>
      )}
      {tab === 'rendez-vous' && <ReceptionBookAppointment />}
      {tab === 'schedule' && <MySchedule />}
      {tab === 'messages' && <PatientMessaging />}

      {tab === 'internal-messages' && <InternalMessaging />}
    </SidebarLayout>
  )
}
