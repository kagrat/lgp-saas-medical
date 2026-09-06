import { useEffect, useState } from 'react'
import { BarChart, Pill, Package, MessageSquare, Clock } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'
import PharmacyStatsCards from '../components/PharmacyStatsCards'
import { RESERVATION_STATUSES, RESERVATION_STATUS_LABELS, RESERVATION_STEPS, STAFF_UPDATABLE_STATUSES, STAFF_ACTIONABLE_STATUSES, StatusBadge } from '../components/OrderStatus'
import FilterTabs from '../components/FilterTabs'
import StatusStepper from '../components/StatusStepper'
import ReservationReviewForm from '../components/ReservationReviewForm'
import ChatWindow from '../components/ChatWindow'
import MySchedule from '../components/MySchedule'
import SidebarLayout from '../components/SidebarLayout'

export default function DesktopPharmacistDashboard() {
  const [establishment, setEstablishment] = useState(null)
  const [tab, setTab] = useState('orders')
  const [stock, setStock] = useState([])
  const [orders, setOrders] = useState([])
  const [orderFilter, setOrderFilter] = useState('pending')
  const [conversations, setConversations] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [error, setError] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState(null)
  const [orderUpdateForm, setOrderUpdateForm] = useState({})
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const [orderHistory, setOrderHistory] = useState({})
  const [newStock, setNewStock] = useState({ reference: '', medication_name: '', category: '', quantity: '', alert_threshold: 10, unit_price: '' })

  useEffect(() => {
    loadEstablishment()
    loadStock()
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

  async function loadStock() {
    try {
      const { data } = await api.get('/pharmacy/stock')
      setStock(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le stock.'))
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

  async function loadConversations() {
    try {
      const { data } = await api.get('/messages/establishment/patients')
      setConversations(data)
      if (data.length > 0 && !selectedPatientId) setSelectedPatientId(data[0].patient_id)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les conversations.'))
    }
  }

  async function handleAddStock(e) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/pharmacy/stock', {
        ...newStock,
        quantity: Number(newStock.quantity),
        alert_threshold: Number(newStock.alert_threshold),
        unit_price: Number(newStock.unit_price),
      })
      setNewStock({ reference: '', medication_name: '', category: '', quantity: '', alert_threshold: 10, unit_price: '' })
      await loadStock()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce médicament."))
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
    { id: 'pharmacy', label: 'Pharmacie', icon: Pill },
    { id: 'orders', label: 'Commandes', icon: Package, badge: pendingCount },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
    // NOUVEAU (demande M. Faustin): Statistiques en derniere position.
    { id: 'stats', label: 'Statistiques', icon: BarChart },
  ]

  const orderFilterOptions = [{ value: 'all', label: 'Tous' }, ...RESERVATION_STATUSES.map((s) => ({ value: s, label: RESERVATION_STATUS_LABELS[s] }))]
  const filteredOrders = orderFilter === 'all' ? orders : orders.filter((o) => o.status === orderFilter)
  const selectedConversation = conversations.find((c) => c.patient_id === selectedPatientId)

  return (
    <SidebarLayout
      portalLabel="Portail Pharmacie"
      title={establishment ? establishment.name : 'Chargement...'}
      subtitle="Ton espace pharmacien."
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setError('') }}
      accentColor="bg-success-700"
    >
      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'stats' && <PharmacyStatsCards />}

      {tab === 'pharmacy' && (
        <div>
          <form onSubmit={handleAddStock} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-6">
            <input required placeholder="Référence (ex: MED-00123)" value={newStock.reference}
              onChange={(e) => setNewStock({ ...newStock, reference: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required placeholder="Nom du médicament" value={newStock.medication_name}
              onChange={(e) => setNewStock({ ...newStock, medication_name: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input placeholder="Catégorie" value={newStock.category}
              onChange={(e) => setNewStock({ ...newStock, category: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required type="number" placeholder="Quantite" value={newStock.quantity}
              onChange={(e) => setNewStock({ ...newStock, quantity: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required type="number" placeholder="Seuil d'alerte" value={newStock.alert_threshold}
              onChange={(e) => setNewStock({ ...newStock, alert_threshold: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required type="number" placeholder="Prix unitaire (FCFA)" value={newStock.unit_price}
              onChange={(e) => setNewStock({ ...newStock, unit_price: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <button type="submit" className="rounded-full bg-[var(--portal-accent)] text-white py-2.5 font-medium hover:brightness-90 transition">
              Ajouter au stock
            </button>
          </form>
          <div className="space-y-2">
            {stock.map((s) => (
              <div key={s.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
                <div>
                  <p className="text-forest-900 font-medium">{s.medication_name} <span className="text-xs text-forest-700 font-normal">({s.reference})</span></p>
                  <p className="text-sm text-forest-700">{s.quantity} en stock - {s.unit_price.toLocaleString('fr-FR')} FCFA</p>
                </div>
                {s.is_low_stock && <span className="text-xs px-3 py-1 rounded-full bg-clay-500/10 text-clay-600 font-medium">Stock bas</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'schedule' && <MySchedule />}

      {tab === 'orders' && (
        <div>
          <FilterTabs options={orderFilterOptions} active={orderFilter} onChange={setOrderFilter} counts={orderCounts} />
          <div className="space-y-3">
            {filteredOrders.length === 0 && <p className="text-forest-700">Aucune commande dans cette catégorie.</p>}
            {filteredOrders.map((o) => (
              o.status === 'delivered' ? (
                // NOUVEAU (demande M. Faustin, appliquee aussi cote
                // pharmacien pour coherence): une commande deja livree n'a
                // plus besoin du parcours detaille en 7 etapes - juste une
                // ligne compacte, avec le detail complet disponible via
                // "Voir le suivi".
                <div key={o.id} className="rounded-xl border border-forest-100 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-forest-900 font-medium">
                        {o.items.map((item) => item.medication_name).join(', ')}
                      </p>
                      <p className="text-sm text-forest-700 mt-0.5">
                        Livree - {o.delivery_mode === 'delivery' ? 'Livraison' : 'Retrait sur place'}
                      </p>
                    </div>
                    <button onClick={() => toggleOrderHistory(o.id)} className="text-xs text-amber-600 hover:underline shrink-0 ml-3">
                      {expandedOrderId === o.id ? 'Masquer le suivi' : 'Voir le suivi'}
                    </button>
                  </div>
                  {expandedOrderId === o.id && orderHistory[o.id] && (
                    <div className="mt-3 pt-3 border-t border-forest-100 space-y-2">
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
              ) : (
              <div key={o.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="mb-3">
                  {o.prescription_document_id && (
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium mb-2">
                      Issue d'une ordonnance
                    </span>
                  )}
                  <div className="space-y-1 mb-2">
                    {o.items.map((item) => (
                      <p key={item.id} className="text-forest-900 font-medium">
                        {item.quantity}x {item.medication_name} <span className="text-xs text-forest-700 font-normal">({item.medication_reference})</span>
                      </p>
                    ))}
                  </div>
                  <p className="text-sm text-forest-700 mb-3">
                    {o.delivery_mode === 'delivery' ? 'Livraison' : 'Retrait sur place'}
                  </p>
                  <StatusStepper steps={RESERVATION_STEPS} currentValue={o.status} labels={RESERVATION_STATUS_LABELS} />
                </div>

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
              </div>
              )
            ))}
          </div>
        </div>
      )}

      {tab === 'messages' && (
        <div>
          {conversations.length === 0 ? (
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
