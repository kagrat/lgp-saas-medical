import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Phone, MapPin } from 'lucide-react'
import api, { getRole, getErrorMessage } from '../api/client'
import StarRating from '../components/StarRating'
import BookingConfirmStep from '../components/BookingConfirmStep'
import StepIndicator from '../components/StepIndicator'

export default function DoctorProfile() {
  const { doctorId } = useParams()
  const [doctor, setDoctor] = useState(null)
  const [reviews, setReviews] = useState([])
  const [error, setError] = useState('')

  const [searchDate, setSearchDate] = useState('')
  const [searchTime, setSearchTime] = useState('')
  const [suggestions, setSuggestions] = useState(null)
  const [searching, setSearching] = useState(false)
  const [pendingSlot, setPendingSlot] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const role = getRole()

  useEffect(() => {
    load()
  }, [doctorId])

  async function load() {
    try {
      const [docRes, reviewsRes] = await Promise.all([
        api.get(`/doctors/${doctorId}/profile`),
        api.get(`/doctors/${doctorId}/reviews`),
      ])
      setDoctor(docRes.data)
      setReviews(reviewsRes.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger ce profil.'))
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    setSuggestions(null)
    setSearching(true)
    try {
      const { data } = await api.post('/appointments/search', {
        doctor_id: doctorId,
        specialty: doctor.specialty,
        preferred_date: searchDate,
        preferred_time: searchTime || null,
        city: doctor.establishment_city,
      })
      setSuggestions(data)
    } catch (err) {
      setError(getErrorMessage(err, 'La recherche a echoue.'))
    } finally {
      setSearching(false)
    }
  }

  if (!doctor) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-14">
        {error ? <p className="text-clay-600">{error}</p> : <p className="text-forest-700">Chargement...</p>}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <div className="rounded-2xl border border-forest-100 bg-white p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl text-forest-900 font-semibold">{doctor.full_name}</h1>
            <p className="text-forest-700">{doctor.specialty}</p>
            <StarRating rating={doctor.average_rating} reviewCount={doctor.review_count} />
          </div>
          <p className="text-amber-600 font-semibold">{doctor.consultation_price.toLocaleString('fr-FR')} FCFA</p>
        </div>

        <div className="flex flex-col gap-1 text-sm text-forest-700 mb-4">
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4" strokeWidth={1.75} />
            {doctor.establishment_name} - {doctor.establishment_city}
            {doctor.establishment_address ? `, ${doctor.establishment_address}` : ''}
          </span>
          {doctor.phone && (
            <span className="flex items-center gap-2">
              <Phone className="w-4 h-4" strokeWidth={1.75} />
              {doctor.phone}
            </span>
          )}
        </div>

        {doctor.bio && (
          <div className="mb-2">
            <p className="text-sm font-medium text-forest-900 mb-1">A propos</p>
            <p className="text-sm text-forest-700">{doctor.bio}</p>
          </div>
        )}
      </div>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {confirmation ? (
        <div className="rounded-2xl border border-forest-300 bg-forest-50 p-6 mb-6">
          <p className="font-display text-xl text-forest-900 font-semibold mb-1">Rendez-vous confirme</p>
          <p className="text-forest-700">
            Le {new Date(confirmation.scheduled_at).toLocaleString('fr-FR')} - une confirmation te sera envoyee par email/SMS.
          </p>
        </div>
      ) : pendingSlot ? (
        <BookingConfirmStep
          slot={pendingSlot}
          stepTotal={2}
          stepCurrent={2}
          onConfirmed={(appt) => { setConfirmation(appt); setPendingSlot(null) }}
          onCancel={() => setPendingSlot(null)}
        />
      ) : (
        <div className="rounded-2xl border border-forest-100 bg-white p-6 mb-6">
          <StepIndicator current={1} total={2} label="Choisis un creneau" />
          <h2 className="font-display text-xl text-forest-900 font-semibold mb-4">Choisis un creneau</h2>
          <form onSubmit={handleSearch} className="grid sm:grid-cols-2 gap-3 mb-4">
            <input type="date" required value={searchDate} onChange={(e) => setSearchDate(e.target.value)}
              className="rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
            <input type="time" value={searchTime} onChange={(e) => setSearchTime(e.target.value)}
              placeholder="Heure preferee (optionnel)"
              className="rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
            <button type="submit" disabled={searching}
              className="sm:col-span-2 rounded-full bg-forest-700 text-white py-2.5 font-medium hover:bg-forest-900 transition disabled:opacity-50">
              {searching ? 'Recherche...' : 'Voir les creneaux disponibles'}
            </button>
          </form>

          {suggestions && (
            <div>
              {suggestions.suggestions.length === 0 ? (
                <p className="text-forest-700 text-sm">Aucun creneau disponible pour cette date.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {suggestions.suggestions.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => role === 'patient' ? setPendingSlot(slot) : setError('Connecte-toi avec un compte patient pour reserver.')}
                      className="text-left rounded-xl border border-forest-100 p-3 hover:border-forest-300 transition"
                    >
                      <p className="text-sm text-forest-900 font-medium">
                        {new Date(slot.slot_start).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {role !== 'patient' && (
                <p className="text-sm text-forest-700 mt-4">
                  <Link to="/connexion" className="text-amber-600 font-medium hover:underline">Connecte-toi</Link> ou{' '}
                  <Link to="/inscription" className="text-amber-600 font-medium hover:underline">cree un compte patient</Link> pour reserver.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="font-display text-xl text-forest-900 font-semibold mb-4">Avis ({reviews.length})</h2>
        {reviews.length === 0 && <p className="text-forest-700 text-sm">Aucun avis pour le moment.</p>}
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-forest-100 bg-white p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-forest-900">{r.patient_name}</p>
                <StarRating rating={r.rating} />
              </div>
              {r.comment && <p className="text-sm text-forest-700">{r.comment}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
