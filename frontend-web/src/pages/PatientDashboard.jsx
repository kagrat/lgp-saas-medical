import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { StatusBadge, RESERVATION_STEPS, RESERVATION_STATUS_LABELS } from '../components/OrderStatus'
import { DocumentTypeBadge } from '../components/DocumentType'
import { LabStatusBadge, LAB_STEPS, LAB_STATUS_LABELS } from '../components/LabStatus'
import { AppointmentStatusBadge } from '../components/AppointmentStatusUI'
import StatusStepper from '../components/StatusStepper'
import { downloadDocumentAsPdf } from '../utils/pdf'

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([])
  const [reviewable, setReviewable] = useState([])
  const [orders, setOrders] = useState([])
  const [orderHistory, setOrderHistory] = useState({})
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const [healthRecords, setHealthRecords] = useState([])
  const [labTests, setLabTests] = useState([])
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)
  const [reviewForms, setReviewForms] = useState({})
  const [savingReviewFor, setSavingReviewFor] = useState(null)
  const [reviewMessage, setReviewMessage] = useState('')
  const [confirmingOrderId, setConfirmingOrderId] = useState(null)
  const [receivingOrderId, setReceivingOrderId] = useState(null)

  useEffect(() => {
    loadAppointments()
    loadReviewable()
    loadOrders()
    loadHealthRecords()
    loadLabTests()
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
      // silencieux
    }
  }

  async function loadOrders() {
    try {
      const { data } = await api.get('/pharmacy/reservations/mine')
      setOrders(data)
    } catch (err) {
      // silencieux
    }
  }

  async function loadHealthRecords() {
    try {
      const { data } = await api.get('/health-records/mine')
      setHealthRecords(data)
    } catch (err) {
      // silencieux
    }
  }

  async function loadLabTests() {
    try {
      const { data } = await api.get('/lab/tests/mine')
      setLabTests(data)
    } catch (err) {
      // silencieux
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
      setError(getErrorMessage(err, "Impossible de confirmer la reception de cette commande."))
    } finally {
      setReceivingOrderId(null)
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

  function downloadHealthRecordPdf(doc) {
    downloadDocumentAsPdf({
      title: doc.title,
      subtitle: doc.document_type,
      meta: [
        `Medecin: ${doc.doctor_name}`,
        `Etablissement: ${doc.establishment_name}`,
        `Date: ${new Date(doc.created_at).toLocaleDateString('fr-FR')}`,
      ],
      content: doc.content,
      filename: `${doc.title.replace(/[^a-z0-9]/gi, '_')}.pdf`,
    })
  }

  function downloadLabResultPdf(test) {
    downloadDocumentAsPdf({
      title: test.test_name,
      subtitle: "Resultat d'analyse",
      meta: [
        `Laboratoire: ${test.establishment_name}`,
        `Date: ${new Date(test.created_at).toLocaleDateString('fr-FR')}`,
      ],
      content: test.results_text || 'Resultats non encore disponibles.',
      filename: `${test.test_name.replace(/[^a-z0-9]/gi, '_')}_resultats.pdf`,
    })
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
                <div className="mt-1"><AppointmentStatusBadge status={a.status} /></div>
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
                  <p className="text-sm text-forest-700 mb-3">
                    {o.delivery_mode === 'delivery' ? 'Livraison' : 'Retrait sur place'}
                  </p>
                  <StatusStepper steps={RESERVATION_STEPS} currentValue={o.status} labels={RESERVATION_STATUS_LABELS} />

                  {o.status === 'awaiting_confirmation' && (
                    <div className="mt-4 pt-4 border-t border-forest-100 bg-amber-50 -mx-4 px-4 pb-1 rounded-b-xl">
                      <p className="text-sm font-medium text-forest-900 mb-1">La pharmacie propose :</p>
                      <div className="text-sm text-forest-700 mb-2">
                        {o.items.map((item) => (
                          <p key={item.id}>
                            {item.medication_name}: {item.confirmed_quantity} unite(s) a {item.confirmed_unit_price?.toLocaleString('fr-FR')} FCFA piece
                          </p>
                        ))}
                      </div>
                      {o.total_amount !== null && o.total_amount !== undefined && (
                        <p className="text-sm text-forest-900 font-medium mb-3">Total: {o.total_amount.toLocaleString('fr-FR')} FCFA</p>
                      )}
                      {o.pharmacist_note && <p className="text-sm text-forest-700 italic mb-3">Note: {o.pharmacist_note}</p>}
                      <div className="flex gap-2 pb-3">
                        <button
                          onClick={() => confirmOrder(o.id)}
                          disabled={confirmingOrderId === o.id}
                          className="rounded-full bg-forest-700 text-white px-5 py-1.5 text-sm font-medium hover:bg-forest-900 transition disabled:opacity-50"
                        >
                          {confirmingOrderId === o.id ? '...' : 'Confirmer'}
                        </button>
                        <button
                          onClick={() => rejectOrder(o.id)}
                          disabled={confirmingOrderId === o.id}
                          className="rounded-full border border-clay-500 text-clay-600 px-5 py-1.5 text-sm hover:bg-clay-500 hover:text-white transition disabled:opacity-50"
                        >
                          Refuser
                        </button>
                      </div>
                    </div>
                  )}

                  {o.estimated_ready_at && (
                    <p className="text-sm text-forest-700 mt-3">
                      Pret estime le {new Date(o.estimated_ready_at).toLocaleString('fr-FR')}
                    </p>
                  )}
                  {o.pharmacist_note && o.status !== 'awaiting_confirmation' && (
                    <p className="text-sm text-forest-700 italic">Note de la pharmacie: {o.pharmacist_note}</p>
                  )}

                  {(o.status === 'ready' || o.status === 'out_for_delivery') && (
                    <div className="mt-3 pt-3 border-t border-forest-100">
                      <button
                        onClick={() => markOrderReceived(o.id)}
                        disabled={receivingOrderId === o.id}
                        className="rounded-full bg-forest-700 text-white px-5 py-1.5 text-sm font-medium hover:bg-forest-900 transition disabled:opacity-50"
                      >
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
        </section>
      )}

      {labTests.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Mes analyses</h2>
          <div className="space-y-3">
            {labTests.map((t) => (
              <div key={t.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="mb-3">
                  <p className="text-forest-900 font-medium">{t.test_name}</p>
                  <p className="text-sm text-forest-700 mb-1">{t.establishment_name}</p>
                  {t.referred_by_establishment_name && (
                    <p className="text-xs text-amber-600 mb-2">
                      Prescrit par {t.referred_by_doctor_name || 'un medecin'} ({t.referred_by_establishment_name})
                    </p>
                  )}
                  <StatusStepper steps={LAB_STEPS} currentValue={t.status} labels={LAB_STATUS_LABELS} />
                </div>
                {t.results_text && (
                  <div className="mt-2 pt-2 border-t border-forest-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-forest-900 font-medium">Resultats:</p>
                      <button onClick={() => downloadLabResultPdf(t)} className="text-xs text-amber-600 hover:underline">
                        Telecharger PDF
                      </button>
                    </div>
                    <p className="text-sm text-forest-700">{t.results_text}</p>
                  </div>
                )}
                {t.lab_technician_note && (
                  <p className="text-sm text-forest-700 italic mt-1">Note du laboratoire: {t.lab_technician_note}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {healthRecords.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Mon dossier de sante</h2>
          <p className="text-sm text-forest-700 mb-4">
            Ordonnances, resultats et notes de consultation, tous etablissements confondus.
          </p>
          <div className="space-y-3">
            {healthRecords.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-forest-900 font-medium">{doc.title}</p>
                  <div className="flex items-center gap-2">
                    <DocumentTypeBadge type={doc.document_type} />
                    <button onClick={() => downloadHealthRecordPdf(doc)} className="text-xs text-amber-600 hover:underline">
                      Telecharger PDF
                    </button>
                  </div>
                </div>
                <p className="text-sm text-forest-700 mb-2">{doc.content}</p>
                <p className="text-xs text-forest-700">
                  {doc.doctor_name} - {doc.establishment_name} - {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                </p>
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
            <div key={a.id} className="rounded-xl border border-forest-100 bg-white/60 p-4 flex items-center justify-between">
              <p className="text-forest-900">
                {new Date(a.scheduled_at).toLocaleDateString('fr-FR')}
              </p>
              <AppointmentStatusBadge status={a.status} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
