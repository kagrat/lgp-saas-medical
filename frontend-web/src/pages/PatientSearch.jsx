import StarRating from '../components/StarRating'
import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { getRole } from '../api/client'
import { Link } from 'react-router-dom'
import { SPECIALTIES } from '../constants'

export default function PatientSearch() {
  const [form, setForm] = useState({ specialty: '', city: '', preferred_date: '', preferred_time: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [bookingSlot, setBookingSlot] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const role = getRole()

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const payload = {
        specialty: form.specialty,
        city: form.city || null,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time || null,
      }
      const { data } = await api.post('/appointments/search', payload)
      setResult(data)
    } catch (err) {
      setError(getErrorMessage(err, "La recherche a echoue. Verifie les champs et reessaie."))
    } finally {
      setLoading(false)
    }
  }

  async function confirmBooking(slot) {
    if (role !== 'patient') {
      setError('Connecte-toi avec un compte patient pour confirmer un rendez-vous.')
      return
    }
    setBookingSlot(slot.doctor_id + slot.slot_start)
    try {
      const { data } = await api.post('/appointments', {
        doctor_id: slot.doctor_id,
        scheduled_at: slot.slot_start,
        duration_minutes: 30,
      })
      setConfirmation(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Ce creneau vient peut-etre d\'etre pris. Choisis-en un autre.'))
    } finally {
      setBookingSlot(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Recherche et decouverte</p>
      <h1 className="font-display text-4xl font-semibold text-forest-900 mb-3">
        Trouve un medecin, on te propose toujours un creneau.
      </h1>
      <p className="text-forest-700 max-w-2xl mb-10">
        Si le medecin demande n'est pas disponible, la plateforme suggere automatiquement
        d'autres creneaux, d'autres medecins de la meme specialite, ou un autre etablissement adherent proche.
      </p>

      <form onSubmit={handleSearch} className="grid sm:grid-cols-2 gap-4 bg-white rounded-2xl p-6 border border-forest-100 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Specialite</label>
          <select required value={form.specialty} onChange={(e) => update('specialty', e.target.value)}
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500 bg-white">
            <option value="" disabled>Choisis une specialite</option>
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Ville</label>
          <input value={form.city} onChange={(e) => update('city', e.target.value)}
            placeholder="Cotonou, Parakou, Porto-Novo..."
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Date souhaitee</label>
          <input type="date" required value={form.preferred_date} onChange={(e) => update('preferred_date', e.target.value)}
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Heure souhaitee (optionnel)</label>
          <input type="time" value={form.preferred_time} onChange={(e) => update('preferred_time', e.target.value)}
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={loading}
            className="w-full sm:w-auto rounded-full bg-forest-700 text-white px-8 py-3 font-medium hover:bg-forest-900 transition disabled:opacity-50">
            {loading ? 'Recherche...' : 'Rechercher un creneau'}
          </button>
        </div>
      </form>

      {error && <p className="text-clay-600 mt-6">{error}</p>}

      {confirmation && (
        <div className="mt-8 rounded-2xl border border-forest-300 bg-forest-50 p-6">
          <p className="font-display text-xl text-forest-900 font-semibold mb-1">Rendez-vous confirme</p>
          <p className="text-forest-700">
            Le {new Date(confirmation.scheduled_at).toLocaleString('fr-FR')} - une confirmation te sera envoyee par email/SMS.
          </p>
        </div>
      )}

      {result && !confirmation && (
        <div className="mt-10">
          {result.exact_match_available ? (
            <p className="text-forest-900 font-medium mb-4">Creneau exact disponible :</p>
          ) : (
            <p className="text-forest-900 font-medium mb-4">
              Le creneau exact n'est pas disponible. Voici les meilleures alternatives :
            </p>
          )}

          {result.suggestions.length === 0 && (
            <p className="text-forest-700">Aucun creneau disponible pour ces criteres dans les prochains jours.</p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {result.suggestions.map((slot, idx) => (
              <div key={idx} className="rounded-xl border border-forest-100 bg-white p-5 flex flex-col gap-2">
                <p className="font-display text-lg text-forest-900 font-semibold">{slot.doctor_name}</p>
                <StarRating rating={slot.average_rating} reviewCount={slot.review_count} />
                <p className="text-sm text-forest-700">{slot.establishment_name}</p>
                <p className="text-sm text-forest-700">
                  {new Date(slot.slot_start).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-sm text-amber-600 font-medium">{slot.consultation_price.toLocaleString('fr-FR')} FCFA</p>
                <button
                  onClick={() => confirmBooking(slot)}
                  disabled={bookingSlot === slot.doctor_id + slot.slot_start}
                  className="mt-2 rounded-full bg-amber-500 text-forest-900 py-2 font-semibold hover:bg-amber-400 transition disabled:opacity-50"
                >
                  {bookingSlot === slot.doctor_id + slot.slot_start ? 'Confirmation...' : 'Confirmer ce creneau'}
                </button>
              </div>
            ))}
          </div>

          {role !== 'patient' && (
            <p className="text-sm text-forest-700 mt-6">
              <Link to="/connexion" className="text-amber-600 font-medium hover:underline">Connecte-toi</Link> ou{' '}
              <Link to="/inscription" className="text-amber-600 font-medium hover:underline">cree un compte patient</Link> pour confirmer un rendez-vous.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
