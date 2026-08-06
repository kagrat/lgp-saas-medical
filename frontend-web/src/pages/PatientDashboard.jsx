import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { StatusBadge } from '../components/OrderStatus'

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([])
  const [reviewable, setReviewable] = useState([])
  const [orders, setOrders] = useState([])
  const [orderHistory, setOrderHistory] = useState({}) // reservation_id -> [history]
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)
  const [reviewForms, setReviewForms] = useState({})
  const [savingReviewFor, setSavingReviewFor] = useState(null)
  const [reviewMessage, setReviewMessage] = useState('')

  useEffect(() => {
    loadAppointments()
    loadReviewable()
    loadOrders()
  }, [])

  async function loadAppointments() {
    try {
      const { data } = await api.get('/appointments/mine')
      setAppointments(data)
    } catch (err) {
      setError("Impossible de charger tes rendez-vous.")
    }
  }

  async function loadReviewable() {
    try {
      const { data } = await api.get('/doctors/reviewable')
      setReviewable(data)
      const initialForms = {}
      data.forEach((d) => {
        initialForms[d.doctor_id] = {
          rating: d.existing_rating || 5,
          comment: d.existing_comment || '',
        }
      })
      setReviewForms(initialForms)
    } catch (err) {
      // silencieux: pas critique si ca echoue
    }
  }

  async function loadOrders() {
    try {
      const { data } = await api.get('/pharmacy/reservations/mine')
      setOrders(data)
    } catch (err) {
      // silencieux: pas critique si ca echoue
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

  async function handleCancel(id) {
    setCancellingId(id)
    try {
      await api.post(`/appointments/${id}/cancel`)
      await loadAppointments()
    } catch (err) {
      setError("L'annulation a echoue.")
    } finally {
      setCancellingId(null)
    }
  }

  async function submitReview(doctorId) {
    setSavingReviewFor(doctorId)
    setReviewMessage('')
    setError('')
    try {
      const form = reviewForms[doctorId]
      await api.post(`/doctors/${doctorId}/reviews`, {
        rating: Number(form.rating),
        comment: form.comment || null,
      })
      setReviewMessage('Merci, ton avis a ete enregistre.')
      await loadReviewable()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer cet avis."))
    } finally {
      setSavingReviewFor(null)
    }
  }

  function updateReviewForm(doctorId, field, value) {
    setReviewForms((forms) => ({ ...forms, [doctorId]: { ...forms[doctorId], [field]: value } }))
  }

  const upcoming = appointments.filter((a) => a.status === 'confirmed' && new Date(a.scheduled_at) > new Date())
  const past = appointments.filter((a) => !(a.status === 'confirmed' && new Date(a.scheduled_at) > new Date()))

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Mon espace patient</h1>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <section className="mb-10">
        <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Rendez-vous a venir</h2>
        {upcoming.length === 0 && <p className="text-forest-700">Aucun rendez-vous a venir.</p>}
        <div className="space-y-3">
          {upcoming.map((a) => (
            <div key={a.id} className="rounded-xl border border-forest-100 bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-forest-900 font-medium">
                  {new Date(a.scheduled_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-sm text-forest-700">Statut: {a.status}</p>
              </div>
              <button
                onClick={() => handleCancel(a.id)}
                disabled={cancellingId === a.id}
                className="rounded-full border border-clay-500 text-clay-600 px-4 py-1.5 text-sm hover:bg-clay-500 hover:text-white transition disabled:opacity-50"
              >
                {cancellingId === a.id ? 'Annulation...' : 'Annuler'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {orders.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Mes commandes pharmacie</h2>
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-forest-900 font-medium">{o.medication_name} <span className="text-xs text-forest-700 font-normal">({o.medication_reference})</span></p>
                    <p className="text-sm text-forest-700">
                      Quantite: {o.quantity} - {o.delivery_mode === 'delivery' ? 'Livraison' : 'Retrait sur place'}
                    </p>
                    {o.estimated_ready_at && (
                      <p className="text-sm text-forest-700">
                        Pret estime le {new Date(o.estimated_ready_at).toLocaleString('fr-FR')}
                      </p>
                    )}
                    {o.pharmacist_note && (
                      <p className="text-sm text-forest-700 italic">Note de la pharmacie: {o.pharmacist_note}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={o.status} />
                    <button onClick={() => toggleOrderHistory(o.id)} className="text-xs text-amber-600 hover:underline">
                      {expandedOrderId === o.id ? 'Masquer le suivi' : 'Voir le suivi'}
                    </button>
                  </div>
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
        </section>
      )}

      {reviewable.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Note tes medecins</h2>
          <p className="text-sm text-forest-700 mb-4">
            Tu peux laisser un avis pour chaque medecin avec qui tu as eu un rendez-vous termine.
          </p>
          {reviewMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-xl p-3 mb-4 text-sm">{reviewMessage}</p>}
          <div className="space-y-4">
            {reviewable.map((d) => (
              <div key={d.doctor_id} className="rounded-xl border border-forest-100 bg-white p-4">
                <p className="text-forest-900 font-medium mb-2">{d.doctor_name} <span className="text-sm text-forest-700 font-normal">({d.specialty})</span></p>
                <div className="flex items-center gap-3 mb-2">
                  <select
                    value={reviewForms[d.doctor_id]?.rating || 5}
                    onChange={(e) => updateReviewForm(d.doctor_id, 'rating', e.target.value)}
                    className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm bg-white"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)} ({n}/5)</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={reviewForms[d.doctor_id]?.comment || ''}
                  onChange={(e) => updateReviewForm(d.doctor_id, 'comment', e.target.value)}
                  placeholder="Ton commentaire (optionnel)"
                  rows={2}
                  className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2"
                />
                <button
                  onClick={() => submitReview(d.doctor_id)}
                  disabled={savingReviewFor === d.doctor_id}
                  className="rounded-full bg-amber-500 text-forest-900 px-5 py-1.5 text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50"
                >
                  {savingReviewFor === d.doctor_id ? 'Envoi...' : d.existing_rating ? "Modifier mon avis" : "Envoyer mon avis"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Historique</h2>
        {past.length === 0 && <p className="text-forest-700">Aucun historique pour le moment.</p>}
        <div className="space-y-3">
          {past.map((a) => (
            <div key={a.id} className="rounded-xl border border-forest-100 bg-white/60 p-4">
              <p className="text-forest-900">
                {new Date(a.scheduled_at).toLocaleDateString('fr-FR')} - {a.status}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
