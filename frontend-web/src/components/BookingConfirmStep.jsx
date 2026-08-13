import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import StepIndicator from './StepIndicator'

/**
 * Etape de recapitulatif avant confirmation finale.
 */
export default function BookingConfirmStep({ slot, onConfirmed, onCancel, stepTotal = 3, stepCurrent = 3 }) {
  const [patient, setPatient] = useState(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setPatient(data)).catch(() => {})
  }, [])

  async function handleConfirm() {
    setConfirming(true)
    setError('')
    try {
      const { data } = await api.post('/appointments', {
        doctor_id: slot.doctor_id,
        scheduled_at: slot.slot_start,
        duration_minutes: 30,
      })
      onConfirmed(data)
    } catch (err) {
      setError(getErrorMessage(err, "Ce creneau vient peut-etre d'etre pris. Choisis-en un autre."))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-2xl border border-forest-100 bg-white p-6">
      <StepIndicator current={stepCurrent} total={stepTotal} label="Confirme ton rendez-vous" />
      <h2 className="font-display text-2xl text-forest-900 font-semibold mb-6">Confirme ton rendez-vous</h2>

      <div className="rounded-xl bg-forest-50 p-4 mb-4">
        <p className="text-forest-900 font-medium">{slot.doctor_name}</p>
        <p className="text-sm text-forest-700">{slot.establishment_name}</p>
        <p className="text-sm text-forest-700">
          {new Date(slot.slot_start).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-sm text-amber-600 font-medium mt-1">{slot.consultation_price.toLocaleString('fr-FR')} FCFA</p>
      </div>

      {patient && (
        <div className="mb-6">
          <p className="text-sm font-medium text-forest-900 mb-2">Informations patient</p>
          <p className="text-sm text-forest-700">{patient.full_name}</p>
          {patient.phone && <p className="text-sm text-forest-700">{patient.phone}</p>}
          <p className="text-sm text-forest-700">{patient.email}</p>
        </div>
      )}

      {error && <p className="text-clay-600 text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="flex-1 rounded-full bg-forest-700 text-white py-3 font-medium hover:bg-forest-900 transition disabled:opacity-50"
        >
          {confirming ? 'Confirmation...' : 'Confirmer le rendez-vous'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-full border border-forest-300 px-6 py-3 text-forest-900 hover:bg-forest-50 transition"
        >
          Retour
        </button>
      </div>
    </div>
  )
}
