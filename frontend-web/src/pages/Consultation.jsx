import { useState } from 'react'
import api, { getErrorMessage, getRole } from '../api/client'
import { Link } from 'react-router-dom'
import { SPECIALTIES } from '../constants'
import StarRating from '../components/StarRating'
import BookingConfirmStep from '../components/BookingConfirmStep'
import StepIndicator from '../components/StepIndicator'

const TOTAL_STEPS = 5

/**
 * NOUVEAU parcours "Consultation" (etablissement-first), en remplacement du
 * flux "Trouver medecin" ou le systeme proposait directement les meilleurs
 * creneaux. Ici le patient choisit d'abord une specialite, puis un
 * ETABLISSEMENT (classes par proximite reelle), puis un medecin de cet
 * etablissement, verifie sa disponibilite, et confirme.
 *
 * N'ecrase pas /rechercher (PatientSearch.jsx) qui reste disponible.
 */
export default function Consultation() {
  const [step, setStep] = useState(1) // 1: specialite/ville, 2: etablissements, 3: medecins, 4: creneaux, 5: confirmation
  const [form, setForm] = useState({ specialty: '', city: '' })
  const [establishments, setEstablishments] = useState([])
  const [selectedEstablishment, setSelectedEstablishment] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [preferredDate, setPreferredDate] = useState('')
  const [slots, setSlots] = useState(null)
  const [pendingSlot, setPendingSlot] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const role = getRole()

  function todayISO() {
    return new Date().toISOString().slice(0, 10)
  }

  async function searchEstablishments(e) {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get('/establishments/search', {
        params: { specialty: form.specialty, city: form.city || undefined },
      })
      setEstablishments(data)
      setStep(2)
    } catch (err) {
      setError(getErrorMessage(err, "La recherche a échoué. Vérifie les champs et reessaie."))
    } finally {
      setLoading(false)
    }
  }

  async function chooseEstablishment(establishment) {
    setSelectedEstablishment(establishment)
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get('/doctors/search', {
        params: { specialty: form.specialty, establishment_id: establishment.id },
      })
      setDoctors(data)
      setStep(3)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger les médecins de cet établissement."))
    } finally {
      setLoading(false)
    }
  }

  function chooseDoctor(doctor) {
    setSelectedDoctor(doctor)
    setPreferredDate(todayISO())
    setSlots(null)
    setStep(4)
  }

  async function checkAvailability(e) {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/appointments/search', {
        specialty: form.specialty,
        establishment_id: selectedEstablishment.id,
        doctor_id: selectedDoctor.id,
        preferred_date: preferredDate,
      })
      setSlots(data)
    } catch (err) {
      setError(getErrorMessage(err, "La vérification des disponibilités a échoué."))
    } finally {
      setLoading(false)
    }
  }

  function chooseSlot(slot) {
    if (role !== 'patient') {
      setError('Connecte-toi avec un compte patient pour confirmer un rendez-vous.')
      return
    }
    setPendingSlot(slot)
    setStep(5)
  }

  function backTo(target) {
    setError('')
    setStep(target)
  }

  const stepLabels = {
    1: 'Spécialité et ville',
    2: "Choisis un établissement",
    3: 'Choisis un médecin',
    4: 'Vérifie les disponibilités',
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Consultation</p>
      <h1 className="font-display text-4xl font-semibold text-forest-900 mb-3">
        Choisis ton établissement, puis ton médecin.
      </h1>
      <p className="text-forest-700 max-w-2xl mb-10">
        Spécialité d'abord, ensuite l'établissement le plus proche de chez toi, puis le médecin
        de ton choix au sein de cet établissement - avec vérification de ses disponibilités reelles.
      </p>

      {step < 5 && <StepIndicator current={step} total={TOTAL_STEPS} label={stepLabels[step]} />}

      {confirmation ? (
        <div className="rounded-2xl border border-forest-300 bg-forest-50 p-6">
          <p className="font-display text-xl text-forest-900 font-semibold mb-1">Rendez-vous confirmé</p>
          <p className="text-forest-700">
            Le {new Date(confirmation.scheduled_at).toLocaleString('fr-FR')} - une confirmation te sera envoyee par email/SMS.
          </p>
        </div>
      ) : step === 5 && pendingSlot ? (
        <BookingConfirmStep
          slot={pendingSlot}
          stepTotal={TOTAL_STEPS}
          stepCurrent={5}
          onConfirmed={(appt) => setConfirmation(appt)}
          onCancel={() => backTo(4)}
        />
      ) : step === 1 ? (
        <form onSubmit={searchEstablishments} className="grid sm:grid-cols-2 gap-4 bg-white rounded-2xl p-6 border border-forest-100 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Spécialité</label>
            <select required value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500 bg-white">
              <option value="" disabled>Choisis une spécialité</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Ta ville (pour trier par proximité)</label>
            <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="Cotonou, Parakou, Porto-Novo..."
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={loading}
              className="w-full sm:w-auto rounded-full bg-primary-700 text-white px-8 py-3 font-medium hover:bg-primary-900 transition disabled:opacity-50">
              {loading ? 'Recherche...' : 'Voir les etablissements'}
            </button>
          </div>
        </form>
      ) : step === 2 ? (
        <div>
          {establishments.length === 0 && (
            <p className="text-forest-700">Aucun établissement adhérent avec cette spécialité pour le moment.</p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {establishments.map((est) => (
              <button
                key={est.id}
                onClick={() => chooseEstablishment(est)}
                disabled={loading}
                className="text-left rounded-xl border border-forest-100 bg-white p-5 flex flex-col gap-1 hover:border-forest-500 transition disabled:opacity-50"
              >
                <p className="font-display text-lg text-forest-900 font-semibold">{est.name}</p>
                <p className="text-sm text-forest-700">{est.city}{est.address ? ` - ${est.address}` : ''}</p>
                <p className="text-sm text-forest-700">
                  {est.doctor_count} medecin{est.doctor_count > 1 ? 's' : ''} en {form.specialty}
                </p>
                {est.distance_km !== null && est.distance_km !== undefined && (
                  <p className="text-sm text-amber-600 font-medium">{est.distance_km} km</p>
                )}
              </button>
            ))}
          </div>
          <button onClick={() => backTo(1)} className="mt-6 text-sm text-forest-700 hover:text-forest-900 hover:underline">
            ← Modifier ma recherche
          </button>
        </div>
      ) : step === 3 ? (
        <div>
          <p className="text-forest-900 font-medium mb-4">{selectedEstablishment.name}</p>
          {doctors.length === 0 && (
            <p className="text-forest-700">Aucun médecin actif dans cette spécialité pour cet établissement actuellement.</p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {doctors.map((doc) => (
              <button
                key={doc.id}
                onClick={() => chooseDoctor(doc)}
                className="text-left rounded-xl border border-forest-100 bg-white p-5 flex flex-col gap-1 hover:border-forest-500 transition"
              >
                <p className="font-display text-lg text-forest-900 font-semibold">{doc.full_name}</p>
                <StarRating rating={doc.average_rating} reviewCount={doc.review_count} />
                <p className="text-sm text-amber-600 font-medium">{doc.consultation_price.toLocaleString('fr-FR')} FCFA</p>
              </button>
            ))}
          </div>
          <button onClick={() => backTo(2)} className="mt-6 text-sm text-forest-700 hover:text-forest-900 hover:underline">
            ← Changer d'établissement
          </button>
        </div>
      ) : step === 4 ? (
        <div>
          <div className="rounded-xl bg-forest-50 p-4 mb-4">
            <p className="text-forest-900 font-medium">{selectedDoctor.full_name}</p>
            <p className="text-sm text-forest-700">{selectedEstablishment.name}</p>
          </div>

          <form onSubmit={checkAvailability} className="flex flex-wrap items-end gap-4 bg-white rounded-2xl p-6 border border-forest-100 shadow-sm mb-6">
            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Date souhaitée</label>
              <input type="date" required value={preferredDate} min={todayISO()}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
            </div>
            <button type="submit" disabled={loading}
              className="rounded-full bg-primary-700 text-white px-8 py-3 font-medium hover:bg-primary-900 transition disabled:opacity-50">
              {loading ? 'Verification...' : 'Verifier les disponibilites'}
            </button>
          </form>

          {slots && (
            slots.suggestions.length === 0 ? (
              <p className="text-forest-700">Aucun créneau disponible pour ce médecin a cette date. Essaie une autre date.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {slots.suggestions.map((slot, idx) => (
                  <div key={idx} className="rounded-xl border border-forest-100 bg-white p-5 flex flex-col gap-2">
                    <p className="text-sm text-forest-700">
                      {new Date(slot.slot_start).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <button
                      onClick={() => chooseSlot(slot)}
                      className="mt-2 rounded-full bg-amber-500 text-forest-900 py-2 font-semibold hover:bg-amber-400 transition"
                    >
                      Choisir ce créneau
                    </button>
                  </div>
                ))}
              </div>
            )
          )}

          <button onClick={() => backTo(3)} className="mt-6 text-sm text-forest-700 hover:text-forest-900 hover:underline">
            ← Changer de médecin
          </button>

          {role !== 'patient' && (
            <p className="text-sm text-forest-700 mt-6">
              <Link to="/connexion" className="text-amber-600 font-medium hover:underline">Connecte-toi</Link> ou{' '}
              <Link to="/inscription" className="text-amber-600 font-medium hover:underline">créer un compte patient</Link> pour confirmer un rendez-vous.
            </p>
          )}
        </div>
      ) : null}

      {error && <p className="text-clay-600 mt-6">{error}</p>}
    </div>
  )
}
