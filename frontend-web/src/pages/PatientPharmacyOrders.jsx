import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { StatusBadge, RESERVATION_STEPS, RESERVATION_STATUS_LABELS } from '../components/OrderStatus'
import StatusStepper from '../components/StatusStepper'

/**
 * NOUVEAU (demande M. Faustin): "Mes commandes pharmacie" devient sa
 * propre page du menu - avant, ce suivi etait uniquement visible dans
 * "Mon dossier patient", pas assez visible/accessible.
 */
export default function PatientPharmacyOrders() {
  const [orders, setOrders] = useState([])
  const [orderHistory, setOrderHistory] = useState({})
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const [error, setError] = useState('')
  const [confirmingOrderId, setConfirmingOrderId] = useState(null)
  const [receivingOrderId, setReceivingOrderId] = useState(null)
  const [payingOrderId, setPayingOrderId] = useState(null)

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    try {
      const { data } = await api.get('/pharmacy/reservations/mine')
      setOrders(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger tes commandes.'))
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

  async function confirmOrder(orderId) {
    setConfirmingOrderId(orderId)
    setError('')
    try {
      await api.post(`/pharmacy/reservations/${orderId}/confirm`)
      await loadOrders()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de confirmer cette commande."))
    } finally {
      setConfirmingOrderId(null)
    }
  }

  async function rejectOrder(orderId) {
    setConfirmingOrderId(orderId)
    setError('')
    try {
      await api.post(`/pharmacy/reservations/${orderId}/reject`)
      await loadOrders()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de refuser cette commande."))
    } finally {
      setConfirmingOrderId(null)
    }
  }

  async function markOrderReceived(orderId) {
    setReceivingOrderId(orderId)
    setError('')
    try {
      await api.post(`/pharmacy/reservations/${orderId}/mark-received`)
      await loadOrders()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de confirmer la réception de cette commande."))
    } finally {
      setReceivingOrderId(null)
    }
  }

  async function payOrder(orderId) {
    setPayingOrderId(orderId)
    setError('')
    try {
      await api.post(`/pharmacy/reservations/${orderId}/pay`)
      await loadOrders()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer ce paiement."))
    } finally {
      setPayingOrderId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Mes commandes pharmacie</h1>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {orders.length === 0 && <p className="text-forest-700">Aucune commande pour le moment.</p>}

      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl border border-forest-100 bg-white p-4">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="space-y-0.5">
                  {o.items.map((item) => (
                    <p key={item.id} className="text-forest-900 font-medium">
                      {item.quantity}x {item.medication_name} <span className="text-xs text-forest-700 font-normal">({item.medication_reference})</span>
                    </p>
                  ))}
                </div>
                <button onClick={() => toggleOrderHistory(o.id)} className="text-xs text-amber-600 hover:underline shrink-0 ml-3">
                  {expandedOrderId === o.id ? 'Masquer le suivi' : 'Voir le suivi'}
                </button>
              </div>
              <p className="text-sm text-forest-700 mb-3">{o.delivery_mode === 'delivery' ? 'Livraison' : 'Retrait sur place'}</p>
              <StatusStepper steps={RESERVATION_STEPS} currentValue={o.status} labels={RESERVATION_STATUS_LABELS} />

              {o.status === 'awaiting_confirmation' && (
                <div className="mt-4 pt-4 border-t border-forest-100 bg-amber-50 -mx-4 px-4 pb-1 rounded-b-xl">
                  <p className="text-sm font-medium text-forest-900 mb-1">La pharmacie propose :</p>
                  <div className="text-sm text-forest-700 mb-2">
                    {o.items.map((item) => (
                      <p key={item.id}>{item.medication_name}: {item.confirmed_quantity} unite(s) a {item.confirmed_unit_price?.toLocaleString('fr-FR')} FCFA piece</p>
                    ))}
                  </div>
                  {o.total_amount !== null && o.total_amount !== undefined && (
                    <p className="text-sm text-forest-900 font-medium mb-3">Total: {o.total_amount.toLocaleString('fr-FR')} FCFA</p>
                  )}
                  {o.pharmacist_note && <p className="text-sm text-forest-700 italic mb-3">Note: {o.pharmacist_note}</p>}
                  <div className="flex gap-2 pb-3">
                    <button onClick={() => confirmOrder(o.id)} disabled={confirmingOrderId === o.id}
                      className="rounded-full bg-primary-700 text-white px-5 py-1.5 text-sm font-medium hover:bg-primary-900 transition disabled:opacity-50">
                      {confirmingOrderId === o.id ? '...' : 'Confirmer'}
                    </button>
                    <button onClick={() => rejectOrder(o.id)} disabled={confirmingOrderId === o.id}
                      className="rounded-full border border-clay-500 text-clay-600 px-5 py-1.5 text-sm hover:bg-clay-500 hover:text-white transition disabled:opacity-50">
                      Refuser
                    </button>
                  </div>
                </div>
              )}

              {o.estimated_ready_at && (
                <p className="text-sm text-forest-700 mt-3">Pret estime le {new Date(o.estimated_ready_at).toLocaleString('fr-FR')}</p>
              )}
              {o.pharmacist_note && o.status !== 'awaiting_confirmation' && (
                <p className="text-sm text-forest-700 italic">Note de la pharmacie: {o.pharmacist_note}</p>
              )}

              {/* NOUVEAU (demande M. Faustin): paiement en ligne obligatoire
                  avant preparation, UNIQUEMENT pour une livraison. Un
                  retrait sur place n'a pas besoin de payer en ligne - le
                  patient paie directement a la pharmacie. */}
              {o.delivery_mode === 'delivery' && o.status === 'confirmed' && !o.is_paid && (
                <div className="mt-3 pt-3 border-t border-forest-100">
                  <p className="text-sm text-forest-700 mb-2">
                    Livraison choisie - paiement en ligne requis avant que la pharmacie ne prepare ta commande.
                  </p>
                  <button onClick={() => payOrder(o.id)} disabled={payingOrderId === o.id}
                    className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
                    {payingOrderId === o.id ? 'Paiement...' : `Payer votre commande${o.total_amount ? ` (${o.total_amount.toLocaleString('fr-FR')} FCFA)` : ''}`}
                  </button>
                </div>
              )}
              {o.delivery_mode === 'delivery' && o.is_paid && (
                <p className="text-sm text-primary-700 font-medium mt-3">
                  ✓ Payee le {new Date(o.paid_at).toLocaleDateString('fr-FR')}
                </p>
              )}

              {(o.status === 'ready' || o.status === 'out_for_delivery') && (
                <div className="mt-3 pt-3 border-t border-forest-100">
                  <button onClick={() => markOrderReceived(o.id)} disabled={receivingOrderId === o.id}
                    className="rounded-full bg-primary-700 text-white px-5 py-1.5 text-sm font-medium hover:bg-primary-900 transition disabled:opacity-50">
                    {receivingOrderId === o.id ? '...' : "J'ai recu ma commande"}
                  </button>
                </div>
              )}
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
        ))}
      </div>
    </div>
  )
}
