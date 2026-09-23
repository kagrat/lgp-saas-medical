import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { AppointmentStatusBadge } from '../components/AppointmentStatusUI'

/**
 * NOUVEAU (demande M. Faustin): "Mes rendez-vous" devient sa propre page
 * du menu, distincte du dossier medical/ordonnances/analyses.
 */
export default function PatientAppointments() {
  const [appointments, setAppointments] = useState([])
  const [reviewable, setReviewable] = useState([])
  const [reviewForms, setReviewForms] = useState({})
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)
  const [savingReviewFor, setSavingReviewFor] = useState(null)
  const [reviewMessage, setReviewMessage] = useState('')

  useEffect(() => {
    loadAppointments()
    loadReviewable()
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
        initialForms[d.doctor_id] = { rating: d.existing_rating || 5, comment: d.existing_comment || '' }
      })
      setReviewForms(initialForms)
    } catch (err) {
      // silencieux
    }
  }

  async function handleCancel(id) {
    setCancellingId(id)
    try {
      await api.post(`/appointments/${id}/cancel`)
      await loadAppointments()
    } catch (err) {
      setError("L'annulation a échoué.")
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
      await api.post(`/doctors/${doctorId}/reviews`, { rating: Number(form.rating), comment: form.comment || null })
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
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Mes rendez-vous</h1>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <section className="mb-10">
        <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">A venir</h2>
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

      {reviewable.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Note tes médecins</h2>
          <p className="text-sm text-forest-700 mb-4">Tu peux laisser un avis pour chaque médecin avec qui tu as eu un rendez-vous termine.</p>
          {reviewMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-xl p-3 mb-4 text-sm">{reviewMessage}</p>}
          <div className="space-y-4">
            {reviewable.map((d) => (
              <div key={d.doctor_id} className="rounded-xl border border-forest-100 bg-white p-4">
                <p className="text-forest-900 font-medium mb-2">{d.doctor_name} <span className="text-sm text-forest-700 font-normal">({d.specialty})</span></p>
                {/* CORRIGE (demande explicite de M. Faustin: "après cette
                    note l'option disparaît") - une fois un avis deja
                    donne, le formulaire interactif disparait, remplace
                    par une simple confirmation en lecture seule. */}
                {d.existing_rating ? (
                  <p className="text-sm text-forest-700">
                    <span className="text-amber-500">{'★'.repeat(d.existing_rating)}{'☆'.repeat(5 - d.existing_rating)}</span>
                    {' '}({d.existing_rating}/5) - Avis déjà envoyé, merci !
                  </p>
                ) : (
                  <>
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
                      className="rounded-full bg-primary-700 text-white px-5 py-1.5 text-sm font-semibold hover:bg-primary-900 transition disabled:opacity-50"
                    >
                      {savingReviewFor === d.doctor_id ? 'Envoi...' : 'Envoyer mon avis'}
                    </button>
                  </>
                )}
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
              <p className="text-forest-900">{new Date(a.scheduled_at).toLocaleDateString('fr-FR')}</p>
              <AppointmentStatusBadge status={a.status} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
