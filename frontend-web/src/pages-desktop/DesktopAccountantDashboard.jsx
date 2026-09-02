import { useState } from 'react'
import { Receipt, Clock } from 'lucide-react'
import MySchedule from '../components/MySchedule'
import InvoiceManager from '../components/InvoiceManager'
import SidebarLayout from '../components/SidebarLayout'

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
  ]

  return (
    <SidebarLayout
      portalLabel="Portail Comptabilité"
      title="Facturation"
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      accentColor="bg-primary-500"
    >
      {tab === 'billing' && <InvoiceManager />}
      {tab === 'schedule' && <MySchedule />}
    </SidebarLayout>
  )
}
