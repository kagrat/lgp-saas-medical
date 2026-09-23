import { useEffect, useState } from 'react'
import { BarChart, Pill, Package, MessageSquare, Clock, LayoutDashboard, FileBarChart } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'
import PharmacyStatsCards from '../components/PharmacyStatsCards'
import PharmacyDashboard from '../components/PharmacyDashboard'
import InventoryManager from '../components/InventoryManager'
import PharmacyReportsManager from '../components/PharmacyReportsManager'
import { RESERVATION_STATUSES, RESERVATION_STATUS_LABELS, RESERVATION_STEPS, STAFF_UPDATABLE_STATUSES, STAFF_ACTIONABLE_STATUSES, StatusBadge } from '../components/OrderStatus'
import FilterTabs from '../components/FilterTabs'
import StatusStepper from '../components/StatusStepper'
import ReservationReviewForm from '../components/ReservationReviewForm'
import GuestOrderPrescriptionPanel from '../components/GuestOrderPrescriptionPanel'
import ChatWindow from '../components/ChatWindow'
import StartConversation from '../components/StartConversation'
import MySchedule from '../components/MySchedule'
import SidebarLayout from '../components/SidebarLayout'
import NotificationBell from '../components/NotificationBell'
import UserProfileBadge from '../components/UserProfileBadge'

export default function DesktopPharmacistDashboard() {
  const [establishment, setEstablishment] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [orders, setOrders] = useState([])
  const [orderFilter, setOrderFilter] = useState('pending')
  const [conversations, setConversations] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [selectedPatientName, setSelectedPatientName] = useState(null)
  const [error, setError] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState(null)
  const [orderUpdateForm, setOrderUpdateForm] = useState({})
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const [orderHistory, setOrderHistory] = useState({})

  useEffect(() => {
    loadEstablishment()
    loadOrders()
  }, [])

  useEffect(() => {
    if (tab === 'messages') loadConversations()
  }, [tab])

  async function loadEstablishment() {
    try {
      const { data } = await api.get('/establishments/me')
      setEstablishment(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger les informations de l'établissement."))
    }
  }

  async function loadOrders() {
    try {
      const { data } = await api.get('/pharmacy/reservations/establishment')
      setOrders(data)
      const initialOrderForms = {}
      data.forEach((o) => {
        // CORRIGE (bug reel trouve en verification approfondie): si
        // o.status vaut 'confirmed', ce statut n'existe pas dans les
        // options du menu (STAFF_UPDATABLE_STATUSES l'exclut a dessein).
        // Avant ce correctif, le formulaire memorisait quand meme
        // 'confirmed' comme valeur du select, invisible dans la liste
        // d'options - un clic sur "Mettre a jour" sans toucher au menu
        // aurait envoye 'confirmed' au serveur, qui le refuse (statut
        // protege), avec un message confus pour le pharmacien qui n'a
        // pourtant rien choisi d'incoherent. Par defaut sur 'preparing'
        // (etape logique suivante) quand le statut actuel n'est pas une
        // option valide du menu.
        const defaultTargetStatus = STAFF_UPDATABLE_STATUSES.includes(o.status) ? o.status : 'preparing'
        initialOrderForms[o.id] = { status: defaultTargetStatus, note: o.pharmacist_note || '', estimated_ready_at: '' }
      })
      setOrderUpdateForm(initialOrderForms)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les commandes.'))
    }
  }

  async function toggleOrderHistory(reservationId) {
    if (expandedOrderId === reservationId) {
      setExpandedOrderId(null)
      return
    }
    setExpandedOrderId(reservationId)
    if (!orderHistory[reservationId]) {
      try {
        const { data } = await api.get(`/pharmacy/reservations/${reservationId}/history`)
        setOrderHistory((h) => ({ ...h, [reservationId]: data }))
      } catch (err) {
        setError("Impossible de charger le suivi de cette commande.")
      }
    }
  }

  // NOUVEAU (demande explicite de M. Faustin: depuis le raccourci du
  // tableau de bord, cliquer sur une commande doit directement l'ouvrir,
  // prete a traiter, dans l'onglet Commandes). "all" garantit que la
  // commande reste visible peu importe son statut actuel.
  function openOrderFromDashboard(orderId) {
    setTab('orders')
    setOrderFilter('all')
    setExpandedOrderId(orderId)
    if (!orderHistory[orderId]) {
      api.get(`/pharmacy/reservations/${orderId}/history`)
        .then(({ data }) => setOrderHistory((h) => ({ ...h, [orderId]: data })))
        .catch(() => setError("Impossible de charger le suivi de cette commande."))
    }
  }

  async function loadConversations() {
    try {
      const { data } = await api.get('/messages/establishment/patients')
      setConversations(data)
      if (data.length > 0 && !selectedPatientId) setSelectedPatientId(data[0].patient_id)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les conversations.'))
    }
  }

  function updateOrderForm(reservationId, field, value) {
    setOrderUpdateForm((forms) => ({ ...forms, [reservationId]: { ...forms[reservationId], [field]: value } }))
  }

  async function submitOrderUpdate(reservationId) {
    setUpdatingOrderId(reservationId)
    setError('')
    try {
      const form = orderUpdateForm[reservationId]
      await api.patch(`/pharmacy/reservations/${reservationId}/status`, {
        status: form.status,
        note: form.note || null,
        estimated_ready_at: form.estimated_ready_at ? new Date(form.estimated_ready_at).toISOString() : null,
      })
      await loadOrders()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de mettre a jour cette commande."))
    } finally {
      setUpdatingOrderId(null)
    }
  }

  // NOUVEAU (demande M. Faustin): compteurs reels - "pending" (en attente
  // de verification par le pharmacien, la plus urgente/bloquante) affiche
  // un point/badge directement sur le menu, et chaque filtre montre son
  // propre compte (en attente ET confirmee, comme demande).
  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const orderCounts = RESERVATION_STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length
    return acc
  }, { all: orders.length })

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'orders', label: 'Commandes', icon: Package, badge: pendingCount },
    // NOUVEAU (demande explicite de M. Faustin): renomme "Pharmacie" en
    // "Inventaire" et deplace apres Commandes.
    { id: 'inventory', label: 'Inventaire', icon: Pill },
    { id: 'reports', label: 'Rapports', icon: FileBarChart },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
    { id: 'stats', label: 'Statistiques', icon: BarChart },
  ]

  const orderFilterOptions = [{ value: 'all', label: 'Tous' }, ...RESERVATION_STATUSES.map((s) => ({ value: s, label: RESERVATION_STATUS_LABELS[s] }))]
  const filteredOrders = orderFilter === 'all' ? orders : orders.filter((o) => o.status === orderFilter)
  const selectedConversation = conversations.find((c) => c.patient_id === selectedPatientId)
    || (selectedPatientId && selectedPatientName ? { patient_id: selectedPatientId, patient_name: selectedPatientName } : null)

  return (
    <SidebarLayout
      portalLabel="Portail Pharmacie"
      title={establishment ? establishment.name : 'Chargement...'}
      subtitle="Ton espace pharmacien."
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setError('') }}
      accentColor="bg-success-700"
      headerRight={<div className="flex items-center gap-4"><NotificationBell /><UserProfileBadge /></div>}
    >
      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'stats' && <PharmacyStatsCards />}

      {tab === 'dashboard' && <PharmacyDashboard onSelectOrder={openOrderFromDashboard} />}

      {tab === 'inventory' && <InventoryManager />}

      {tab === 'reports' && <PharmacyReportsManager />}

      {tab === 'schedule' && <MySchedule />}

      {tab === 'orders' && (
        <div>
          <FilterTabs options={orderFilterOptions} active={orderFilter} onChange={setOrderFilter} counts={orderCounts} />

          {/* NOUVEAU (demande explicite de M. Faustin): ligne d'entete
              horizontale, puis les commandes disposees en liste compacte
              correspondant a ces colonnes - le detail complet (numero,
              date/heure recue, patient, telephone, ordonnance, mise a
              jour du statut) n'apparait qu'au clic sur "Voir". */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 text-xs font-medium text-forest-700 uppercase tracking-wide">
            <span>N° commande</span>
            <span>Patient</span>
            <span>Date</span>
            <span>Statut</span>
            <span>Action</span>
          </div>

          <div className="space-y-2">
            {filteredOrders.length === 0 && <p className="text-forest-700 px-4">Aucune commande dans cette catégorie.</p>}
            {filteredOrders.map((o) => (
              <div key={o.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="grid sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-center">
                  <span className="text-sm text-forest-900 font-medium">{o.order_number}</span>
                  <span className="text-sm text-forest-900">{o.patient_name}</span>
                  <span className="text-sm text-forest-700">{new Date(o.created_at).toLocaleDateString('fr-FR')}</span>
                  <StatusBadge status={o.status} />
                  <button onClick={() => toggleOrderHistory(o.id)}
                    className="text-sm rounded-full border border-forest-300 px-4 py-1.5 hover:bg-forest-50 transition justify-self-start sm:justify-self-end">
                    {expandedOrderId === o.id ? 'Fermer' : 'Voir'}
                  </button>
                </div>

                {expandedOrderId === o.id && (
                  <div className="mt-4 pt-4 border-t border-forest-100">
                    <div className="grid sm:grid-cols-2 gap-2 mb-4 text-sm">
                      <p><span className="text-forest-700">N° commande:</span> <span className="text-forest-900 font-medium">{o.order_number}</span></p>
                      <p><span className="text-forest-700">Reçue le:</span> <span className="text-forest-900 font-medium">{new Date(o.created_at).toLocaleString('fr-FR')}</span></p>
                      <p><span className="text-forest-700">Patient:</span> <span className="text-forest-900 font-medium">{o.patient_name}</span></p>
                      <p><span className="text-forest-700">Téléphone:</span> <span className="text-forest-900 font-medium">{o.patient_phone || 'Non renseigné'}</span></p>
                    </div>
                    {o.prescription_document_id && (
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium mb-3">
                        Issue d'une ordonnance
                      </span>
                    )}
                    {o.is_guest_order && (
                      <GuestOrderPrescriptionPanel reservation={o} onItemAdded={loadOrders} />
                    )}

                    <div className="space-y-1 mb-3">
                      {o.items.map((item) => (
                        <p key={item.id} className="text-forest-900 font-medium text-sm">
                          {item.quantity}x {item.medication_name} <span className="text-xs text-forest-700 font-normal">({item.medication_reference})</span>
                        </p>
                      ))}
                    </div>
                    <p className="text-sm text-forest-700 mb-3">
                      {o.delivery_mode === 'delivery' ? 'Livraison' : 'Retrait sur place'}
                    </p>

                    {o.status !== 'delivered' && <StatusStepper steps={RESERVATION_STEPS} currentValue={o.status} labels={RESERVATION_STATUS_LABELS} />}

                    {o.status === 'pending' && <ReservationReviewForm reservation={o} onDone={loadOrders} />}

                    {o.status === 'awaiting_confirmation' && (
                      <div className="mt-3 pt-3 border-t border-forest-100">
                        <p className="text-sm text-amber-600 font-medium">En attente de la confirmation du patient</p>
                        {o.items.map((item) => (
                          <p key={item.id} className="text-sm text-forest-700">
                            {item.medication_name}: {item.confirmed_quantity} x {item.confirmed_unit_price?.toLocaleString('fr-FR')} FCFA
                          </p>
                        ))}
                        {o.total_amount !== null && o.total_amount !== undefined && (
                          <p className="text-sm text-forest-900 font-medium mt-1">Total: {o.total_amount.toLocaleString('fr-FR')} FCFA</p>
                        )}
                      </div>
                    )}

                    {STAFF_ACTIONABLE_STATUSES.includes(o.status) && (
                      <div className="mt-3 pt-3 border-t border-forest-100 flex flex-wrap gap-2 items-end">
                        <div>
                          <label className="block text-xs text-forest-700 mb-1">Nouveau statut</label>
                          <select
                            value={orderUpdateForm[o.id]?.status || o.status}
                            onChange={(e) => updateOrderForm(o.id, 'status', e.target.value)}
                            className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm bg-white"
                          >
                            {STAFF_UPDATABLE_STATUSES.map((s) => <option key={s} value={s}>{RESERVATION_STATUS_LABELS[s]}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-forest-700 mb-1">Prêt estimé (optionnel)</label>
                          <input type="datetime-local"
                            value={orderUpdateForm[o.id]?.estimated_ready_at || ''}
                            onChange={(e) => updateOrderForm(o.id, 'estimated_ready_at', e.target.value)}
                            className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm" />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-xs text-forest-700 mb-1">Note pour le patient (optionnel)</label>
                          <input type="text"
                            value={orderUpdateForm[o.id]?.note || ''}
                            onChange={(e) => updateOrderForm(o.id, 'note', e.target.value)}
                            className="w-full rounded-lg border border-forest-100 px-3 py-1.5 text-sm" />
                        </div>
                        <button
                          onClick={() => submitOrderUpdate(o.id)}
                          disabled={updatingOrderId === o.id}
                          className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50"
                        >
                          {updatingOrderId === o.id ? 'Mise a jour...' : 'Mettre a jour'}
                        </button>
                      </div>
                    )}

                    {o.status === 'delivered' && orderHistory[o.id] && (
                      <div className="space-y-2">
                        {orderHistory[o.id].map((h) => (
                          <div key={h.id} className="flex items-center gap-3 text-sm">
                            <StatusBadge status={h.status} />
                            <span className="text-forest-700">{new Date(h.created_at).toLocaleString('fr-FR')}</span>
                            {h.note && <span className="text-forest-700 italic">- {h.note}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div>
          <div className="mb-4">
            <StartConversation
              searchFn={async (query) => {
                const { data } = await api.get('/patients/establishment', { params: query ? { search: query } : {} })
                return data.map((p) => ({ patient_id: p.id, full_name: p.full_name }))
              }}
              onStart={(p) => { setSelectedPatientId(p.patient_id); setSelectedPatientName(p.full_name) }}
            />
          </div>
          {conversations.length === 0 && !selectedConversation ? (
            <p className="text-forest-700">Aucune conversation pour le moment.</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                {conversations.map((c) => (
                  <button
                    key={c.patient_id}
                    onClick={() => setSelectedPatientId(c.patient_id)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      selectedPatientId === c.patient_id ? 'border-forest-700 bg-forest-50' : 'border-forest-100 bg-white hover:bg-forest-50'
                    }`}
                  >
                    <p className="text-forest-900 font-medium text-sm">{c.patient_name}</p>
                    {c.last_message && <p className="text-xs text-forest-700 truncate">{c.last_message}</p>}
                  </button>
                ))}
              </div>
              <div className="sm:col-span-2">
                {selectedConversation && (
                  <ChatWindow
                    key={selectedConversation.patient_id}
                    fetchUrl={`/messages/establishment/conversation/${selectedConversation.patient_id}`}
                    sendUrl={`/messages/establishment/conversation/${selectedConversation.patient_id}`}
                    currentSenderRole="staff"
                    title={selectedConversation.patient_name}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </SidebarLayout>
  )
}
