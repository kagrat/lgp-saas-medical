import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { getRole } from '../api/client'
import { Link } from 'react-router-dom'
import { SPECIALTIES } from '../constants'
import StarRating from '../components/StarRating'
import BookingConfirmStep from '../components/BookingConfirmStep'
import StepIndicator from '../components/StepIndicator'

export default function PatientSearch() {
  const [step, setStep] = useState(1) // 1: recherche, 2: choix du creneau, 3: confirmation
  const [form, setForm] = useState({ specialty: '', city: '', preferred_date: '', preferred_time: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingSlot, setPendingSlot] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [quickRange, setQuickRange] = useState(null) // 'today' | 'tomorrow' | 'week' | null
  const role = getRole()

  function dateOffset(days) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSearch(e) {
    if (e) e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)
    try {
      if (quickRange === 'week') {
        // "Cette semaine": pas de recherche multi-jours cote serveur pour
        // l'instant - on interroge les 7 prochains jours un par un et on
        // fusionne les suggestions, triees par proximite temporelle globale.
        const allSuggestions = []
        let anyExactMatch = false
        for (let i = 0; i < 7; i++) {
          const { data } = await api.post('/appointments/search', {
            specialty: form.specialty,
            city: form.city || null,
            preferred_date: dateOffset(i),
            preferred_time: form.preferred_time || null,
          })
          if (data.exact_match_available) anyExactMatch = true
          allSuggestions.push(...data.suggestions)
        }
        setResult({ exact_match_available: anyExactMatch, suggestions: allSuggestions.slice(0, 12) })
      } else {
        const payload = {
          specialty: form.specialty,
          city: form.city || null,
          preferred_date: form.preferred_date,
          preferred_time: form.preferred_time || null,
        }
        const { data } = await api.post('/appointments/search', payload)
        setResult(data)
      }
      setStep(2)
    } catch (err) {
      setError(getErrorMessage(err, "La recherche a échoué. Vérifie les champs et reessaie."))
    } finally {
      setLoading(false)
    }
  }

  function quickSearch(range) {
    setQuickRange(range)
    const date = range === 'today' ? dateOffset(0) : range === 'tomorrow' ? dateOffset(1) : dateOffset(0)
    update('preferred_date', date)
    if (form.specialty) {
      // Declenche la recherche immediatement si une specialite est deja choisie.
      setTimeout(() => handleSearch(), 0)
    }
  }

  function chooseSlot(slot) {
    if (role !== 'patient') {
      setError('Connecte-toi avec un compte patient pour confirmer un rendez-vous.')
      return
    }
    setPendingSlot(slot)
    setStep(3)
  }

  function backToResults() {
    setPendingSlot(null)
    setStep(2)
  }

  function backToSearch() {
    setResult(null)
    setStep(1)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Recherche et découverte</p>
      <h1 className="font-display text-4xl font-semibold text-forest-900 mb-3">
        Trouve un médecin, on te propose toujours un créneau.
      </h1>
      <p className="text-forest-700 max-w-2xl mb-10">
        Si le médecin demande n'est pas disponible, la plateforme suggere automatiquement
        d'autres créneaux, d'autres médecins de la meme spécialité, ou un autre établissement adhérent proche.
      </p>

      {step < 3 && <StepIndicator current={step} total={3} label={step === 1 ? 'Recherche' : 'Choisis ton creneau'} />}

      {confirmation ? (
        <div className="rounded-2xl border border-forest-300 bg-forest-50 p-6">
          <p className="font-display text-xl text-forest-900 font-semibold mb-1">Rendez-vous confirmé</p>
          <p className="text-forest-700">
            Le {new Date(confirmation.scheduled_at).toLocaleString('fr-FR')} - une confirmation te sera envoyee par email/SMS.
          </p>
        </div>
      ) : step === 3 && pendingSlot ? (
        <BookingConfirmStep
          slot={pendingSlot}
          onConfirmed={(appt) => setConfirmation(appt)}
          onCancel={backToResults}
        />
      ) : step === 1 ? (
        <>
        <div className="flex gap-2 mb-4">
          {[
            { value: 'today', label: "Aujourd'hui" },
            { value: 'tomorrow', label: 'Demain' },
            { value: 'week', label: 'Cette semaine' },
          ].map((opt) => (
            <button
              key={opt.value} type="button"
              onClick={() => setQuickRange(quickRange === opt.value ? null : opt.value)}
              className={`text-sm px-4 py-1.5 rounded-full font-medium transition ${
                quickRange === opt.value ? 'bg-amber-500 text-forest-900' : 'border border-forest-100 text-forest-700 hover:bg-forest-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="grid sm:grid-cols-2 gap-4 bg-white rounded-2xl p-6 border border-forest-100 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Spécialité</label>
            <select required value={form.specialty} onChange={(e) => update('specialty', e.target.value)}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500 bg-white">
              <option value="" disabled>Choisis une spécialité</option>
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
            <label className="block text-sm font-medium text-forest-900 mb-1">
              Date souhaitee {quickRange === 'week' && <span className="text-forest-700 font-normal">(ignorée - recherche sur 7 jours)</span>}
            </label>
            <input type="date" required={quickRange !== 'week'} disabled={quickRange === 'week'}
              value={form.preferred_date}
              onChange={(e) => { update('preferred_date', e.target.value); setQuickRange(null) }}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500 disabled:bg-forest-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Heure souhaitée (optionnel)</label>
            <input type="time" value={form.preferred_time} onChange={(e) => update('preferred_time', e.target.value)}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={loading}
              className="w-full sm:w-auto rounded-full bg-primary-700 text-white px-8 py-3 font-medium hover:bg-primary-900 transition disabled:opacity-50">
              {loading ? 'Recherche...' : 'Rechercher un creneau'}
            </button>
          </div>
        </form>
        </>
      ) : (
        <div>
          {result.exact_match_available ? (
            <p className="text-forest-900 font-medium mb-4">Créneau exact disponible :</p>
          ) : (
            <p className="text-forest-900 font-medium mb-4">
              Le créneau exact n'est pas disponible. Voici les meilleures alternatives :
            </p>
          )}

          {result.suggestions.length === 0 && (
            <p className="text-forest-700">Aucun créneau disponible pour ces critères dans les prochains jours.</p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {result.suggestions.map((slot, idx) => (
              <div key={idx} className="rounded-xl border border-forest-100 bg-white p-5 flex flex-col gap-2">
                <Link to={`/medecin/${slot.doctor_id}`} className="font-display text-lg text-forest-900 font-semibold hover:text-amber-600 transition">
                  {slot.doctor_name}
                </Link>
                <StarRating rating={slot.average_rating} reviewCount={slot.review_count} />
                <p className="text-sm text-forest-700">{slot.establishment_name}</p>
                <p className="text-sm text-forest-700">
                  {new Date(slot.slot_start).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-sm text-amber-600 font-medium">{slot.consultation_price.toLocaleString('fr-FR')} FCFA</p>
                <button
                  onClick={() => chooseSlot(slot)}
                  className="mt-2 rounded-full bg-amber-500 text-forest-900 py-2 font-semibold hover:bg-amber-400 transition"
                >
                  Choisir ce créneau
                </button>
              </div>
            ))}
          </div>

          <button onClick={backToSearch} className="mt-6 text-sm text-forest-700 hover:text-forest-900 hover:underline">
            ← Modifier ma recherche
          </button>

          {role !== 'patient' && (
            <p className="text-sm text-forest-700 mt-6">
              <Link to="/connexion" className="text-amber-600 font-medium hover:underline">Connecte-toi</Link> ou{' '}
              <Link to="/inscription" className="text-amber-600 font-medium hover:underline">créer un compte patient</Link> pour confirmer un rendez-vous.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-clay-600 mt-6">{error}</p>}
    </div>
  )
}
