import { useEffect, useState } from 'react'
import { Users, CalendarClock, Clock, MessageCircle } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'
import TeamMembers from '../components/TeamMembers'
import SchedulingManager from '../components/SchedulingManager'
import MySchedule from '../components/MySchedule'
import SidebarLayout from '../components/SidebarLayout'
import InternalMessaging from '../components/InternalMessaging'
import NotificationBell from '../components/NotificationBell'
import UserProfileBadge from '../components/UserProfileBadge'

/**
 * NOUVEAU (gestion interne complete, demande M. Faustin): espace du
 * responsable RH. Reutilise TeamMembers.jsx (gestion du personnel et des
 * departements) - le Responsable RH a desormais les memes permissions que
 * l'admin d'etablissement sur ces deux points cote serveur.
 */
export default function DesktopHRDashboard() {
  const [establishment, setEstablishment] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('team')

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/establishments/me')
        setEstablishment(data)
      } catch (err) {
        setError(getErrorMessage(err, "Impossible de charger les informations de l'etablissement."))
      }
    })()
  }, [])

  const tabs = [
    { id: 'team', label: 'Equipe', icon: Users },
    { id: 'scheduling', label: 'Planning & Conges', icon: CalendarClock },
    { id: 'my-schedule', label: 'Mon planning', icon: Clock },
    { id: 'internal-messages', label: 'Messagerie interne', icon: MessageCircle },
  ]

  return (
    <SidebarLayout
      portalLabel="Portail Ressources Humaines"
      title={establishment ? establishment.name : 'Gestion du personnel'}
      subtitle="Gere les departements, les membres de l'equipe, leur dossier employe, le planning et les conges."
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setError('') }}
      accentColor="bg-primary-500"
      headerRight={<div className="flex items-center gap-4"><NotificationBell /><UserProfileBadge /></div>}
    >
      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'team' && <TeamMembers />}
      {tab === 'scheduling' && <SchedulingManager />}
      {tab === 'my-schedule' && <MySchedule />}

      {tab === 'internal-messages' && <InternalMessaging />}
    </SidebarLayout>
  )
}
