import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { SPECIALTIES } from '../constants'

/**
 * NOUVEAU (demande M. Faustin): meme scenario que le patient qui choisit
 * lui-meme son medecin selon son motif avant de trouver un etablissement -
 * ici la reception demande "de quoi souffre le patient" (specialite),
 * cherche un medecin de CET etablissement dans cette specialite, verifie
 * ses disponibilites reelles, et reserve directement pour le patient.
 *
 * IMPORTANT: /doctors/search est un endpoint PUBLIC (utilise aussi par des
 * patients anonymes) qui renvoie des medecins de TOUTE la plateforme si
 * establishment_id n'est pas precise - la reception ne doit voir/reserver
 * qu'avec les medecins de SON PROPRE etablissement.
 */
export default function ReceptionBookAppointment() {
  const [establishmentId, setEstablishmentId] = useState(null)
  const [step, setStep] = useState(1) // 1: patient+motif, 2: medecin, 3: creneau, 4: confirmation

  useEffect(() => {
    api.get('/establishments/me').then(({ data }) => setEstablishmentId(data.id)).catch(() => {})
  }, [])

  const [patientSearch, setPatientSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [specialty, setSpecialty] = useState('')

  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)

  const [preferredDate, setPreferredDate] = useState(new Date().toISOString().slice(0, 10))
  const [slots, setSlots] = useState(null)
  const [hasAvailabilityConfigured, setHasAvailabilityConfigured] = useState(true)
  const [confirmation, setConfirmation] = useState(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)

  async function searchPatients(e) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.get('/patients/establishment', { params: patientSearch ? { search: patientSearch } : {} })
      setPatients(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Recherche impossible.'))
    }
  }

  function pickPatient(p) {
    setSelectedPatient(p)
    setPatients([])
    setPatientSearch(p.full_name)
  }

  async function searchDoctors(e) {
    e.preventDefault()
    if (!selectedPatient) {
      setError('Choisis d\'abord le patient dans les résultats de recherche.')
      return
    }
    if (!specialty) {
      setError('Précise de quoi souffre le patient (spécialité recherchée).')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get('/doctors/search', { params: { specialty, establishment_id: establishmentId } })
      setDoctors(data)
      setStep(2)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les médecins.'))
    } finally {
      setLoading(false)
    }
  }

  function chooseDoctor(doctor) {
    setSelectedDoctor(doctor)
    setSlots(null)
    setStep(3)
  }

  async function checkAvailability(e) {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get('/appointments/available-slots', {
        params: { doctor_id: selectedDoctor.id, target_date: preferredDate },
      })
      setSlots(data.slots)
      setHasAvailabilityConfigured(data.has_availability_configured)
    } catch (err) {
      setError(getErrorMessage(err, 'La vérification des disponibilités a échoué.'))
    } finally {
      setLoading(false)
    }
  }

  async function bookSlot(slot) {
    setBooking(true)
    setError('')
    try {
      const { data } = await api.post('/appointments/book-for-patient', {
        patient_id: selectedPatient.id,
        doctor_id: selectedDoctor.id,
        scheduled_at: slot.slot_start,
      })
      setConfirmation(data)
      setStep(4)
    } catch (err) {
      setError(getErrorMessage(err, 'La réservation a échoué.'))
    } finally {
      setBooking(false)
    }
  }

  function startOver() {
    setStep(1)
    setSelectedPatient(null)
    setPatientSearch('')
    setPatients([])
    setSpecialty('')
    setDoctors([])
    setSelectedDoctor(null)
    setSlots(null)
    setConfirmation(null)
    setError('')
  }

  return (
    <div className="rounded-xl border border-forest-100 bg-white p-5">
      <p className="font-medium text-forest-900 mb-1">Prendre rendez-vous pour un patient</p>
      <p className="text-forest-700 text-sm mb-4">
        Pour un patient présent physiquement - indique de quoi il souffre pour trouver le bon médecin.
      </p>

      {error && <p className="text-clay-600 text-sm mb-3">{error}</p>}

      {step === 4 && confirmation ? (
        <div className="rounded-xl border border-primary-300 bg-primary-50 p-4">
          <p className="text-forest-900 font-medium mb-1">Rendez-vous confirmé</p>
          <p className="text-sm text-forest-700">
            {selectedPatient.full_name} - {new Date(confirmation.scheduled_at).toLocaleString('fr-FR')} avec {selectedDoctor.full_name}
          </p>
          <button onClick={startOver} className="text-sm text-primary-700 font-medium hover:underline mt-3">
            Prendre un autre rendez-vous
          </button>
        </div>
      ) : step === 1 ? (
        <div>
          <form onSubmit={searchPatients} className="flex gap-2 mb-3">
            <input
              value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Rechercher le patient par nom..."
              className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-full border border-forest-300 px-4 py-2 text-sm hover:bg-forest-50 transition">
              Chercher
            </button>
          </form>
          {patients.length > 0 && (
            <div className="space-y-1 mb-3">
              {patients.map((p) => (
                <button key={p.id} onClick={() => pickPatient(p)}
                  className="block w-full text-left text-sm rounded-lg border border-forest-100 p-2 hover:border-forest-300 transition">
                  {p.full_name} - dossier {p.dossier_number}
                </button>
              ))}
            </div>
          )}
          {selectedPatient && <p className="text-sm text-forest-900 font-medium mb-3">Patient: {selectedPatient.full_name}</p>}

          <form onSubmit={searchDoctors} className="flex gap-2">
            <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}
              className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
              <option value="" disabled>De quoi souffre le patient ? (spécialité)</option>
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="submit" disabled={loading}
              className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
              {loading ? '...' : 'Chercher un médecin'}
            </button>
          </form>
        </div>
      ) : step === 2 ? (
        <div>
          {doctors.length === 0 && <p className="text-forest-700 text-sm">Aucun médecin actif dans cette spécialité pour le moment.</p>}
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            {doctors.map((doc) => (
              <button key={doc.id} onClick={() => chooseDoctor(doc)}
                className="text-left rounded-xl border border-forest-100 bg-white p-4 hover:border-forest-500 transition">
                <p className="text-forest-900 font-medium">{doc.full_name}</p>
                <p className="text-sm text-amber-600 font-medium">{doc.consultation_price.toLocaleString('fr-FR')} FCFA</p>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="text-sm text-forest-700 hover:underline">← Retour</button>
        </div>
      ) : step === 3 ? (
        <div>
          <div className="rounded-lg bg-forest-50 p-3 mb-3">
            <p className="text-forest-900 font-medium text-sm">{selectedPatient.full_name} - avec {selectedDoctor.full_name}</p>
          </div>
          <form onSubmit={checkAvailability} className="flex items-end gap-3 mb-4">
            <div>
              <label className="block text-xs text-forest-700 mb-1">Date souhaitée</label>
              <input type="date" required value={preferredDate} min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
            <button type="submit" disabled={loading}
              className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
              {loading ? '...' : 'Vérifier les disponibilités'}
            </button>
          </form>

          {slots && (
            slots.length === 0 ? (
              hasAvailabilityConfigured ? (
                <p className="text-forest-700 text-sm">Aucun créneau disponible à cette date.</p>
              ) : (
                <p className="text-clay-600 text-sm">Ce médecin n'a pas encore renseigné ses horaires de disponibilité.</p>
              )
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
                {slots.map((slot, idx) => (
                  <button key={idx} onClick={() => bookSlot(slot)} disabled={booking}
                    className="rounded-lg border border-forest-100 bg-white py-2 text-sm font-medium text-forest-900 hover:border-primary-500 hover:bg-primary-50 transition disabled:opacity-50">
                    {new Date(slot.slot_start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </button>
                ))}
              </div>
            )
          )}
          <button onClick={() => setStep(2)} className="text-sm text-forest-700 hover:underline">← Changer de médecin</button>
        </div>
      ) : null}
    </div>
  )
}
