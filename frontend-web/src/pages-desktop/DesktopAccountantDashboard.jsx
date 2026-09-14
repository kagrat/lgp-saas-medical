import { useState } from 'react'
import { Receipt, Clock, MessageCircle, MessageSquare } from 'lucide-react'
import MySchedule from '../components/MySchedule'
import InvoiceManager from '../components/InvoiceManager'
import SidebarLayout from '../components/SidebarLayout'
import InternalMessaging from '../components/InternalMessaging'
import PatientMessaging from '../components/PatientMessaging'
import NotificationBell from '../components/NotificationBell'
import UserProfileBadge from '../components/UserProfileBadge'

/**
 * NOUVEAU (facturation reelle, chantier prioritaire du cahier des
 * charges): espace comptable reel - creation de factures, encaissement,
 * suivi des impayes. Remplace le placeholder "en construction".
 *
 * REFACTORISE (demande M. Faustin: brancher les fonctionnalites deja
 * construites cote serveur): toute la logique de facturation vit
 * desormais dans InvoiceManager.jsx, partagee avec EstablishmentAdmin.jsx
 * qui avait le meme droit cote serveur mais aucune interface avant ce
 * correctif.
 */
export default function DesktopAccountantDashboard() {
  const [tab, setTab] = useState('billing')

  const tabs = [
    { id: 'billing', label: 'Facturation', icon: Receipt },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'internal-messages', label: 'Messagerie interne', icon: MessageCircle },
  ]

  return (
    <SidebarLayout
      portalLabel="Portail Comptabilité"
      title="Facturation"
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      accentColor="bg-primary-500"
      headerRight={<div className="flex items-center gap-4"><NotificationBell /><UserProfileBadge /></div>}
    >
      {tab === 'billing' && <InvoiceManager />}
      {tab === 'schedule' && <MySchedule />}

      {tab === 'messages' && <PatientMessaging />}

      {tab === 'internal-messages' && <InternalMessaging />}
    </SidebarLayout>
  )
}
