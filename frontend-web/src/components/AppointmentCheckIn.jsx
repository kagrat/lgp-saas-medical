import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { AppointmentStatusBadge } from './AppointmentStatusUI'

/**
 * NOUVEAU (demande M. Faustin): permet a la reception ET a l'infirmier(e)
 * de marquer un patient arrive et de prendre ses constantes (poids,
 * temperature, tension) AVANT la consultation - meme pour un rendez-vous
 * pris directement en ligne par le patient. Composant partage, pas
 * duplique, entre DesktopReceptionistDashboard et DesktopNurseDashboard.
 */
export default function AppointmentCheckIn() {
  const [appointments, setAppointments] = useState([])
  const [error, setError] = useState('')
  const [arrivingId, setArrivingId] = useState(null)

  const [selectedId, setSelectedId] = useState(null)
  const [vitalsHistory, setVitalsHistory] = useState([])
  const [loadingVitals, setLoadingVitals] = useState(false)
  const [vitalsForm, setVitalsForm] = useState({ weight_kg: '', temperature_celsius: '', blood_pressure: '', pulse_bpm: '', respiratory_rate: '' })
  const [savingVitals, setSavingVitals] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setError('')
    try {
      const { data } = await api.get('/appointments/establishment')
      const today = new Date().toDateString()
      const todaysAppointments = data.filter((a) => new Date(a.scheduled_at).toDateString() === today && a.status !== 'completed' && a.status !== 'cancelled')
      setAppointments(todaysAppointments)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les rendez-vous du jour.'))
    }
  }

  async function markArrived(appointmentId) {
    setArrivingId(appointmentId)
    setError('')
    try {
      await api.post(`/appointments/${appointmentId}/arrive`)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de marquer ce patient comme arrive."))
    } finally {
      setArrivingId(null)
    }
  }

  async function openVitals(appointmentId) {
    setSelectedId(appointmentId)
    setVitalsHistory([])
    setLoadingVitals(true)
    setVitalsForm({ weight_kg: '', temperature_celsius: '', blood_pressure: '', pulse_bpm: '', respiratory_rate: '' })
    try {
      const { data } = await api.get(`/appointments/${appointmentId}/vitals`)
      setVitalsHistory(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les constantes.'))
    } finally {
      setLoadingVitals(false)
    }
  }

  async function submitVitals() {
    setSavingVitals(true)
    setError('')
    try {
      await api.post(`/appointments/${selectedId}/vitals`, {
        weight_kg: vitalsForm.weight_kg ? Number(vitalsForm.weight_kg) : null,
        temperature_celsius: vitalsForm.temperature_celsius ? Number(vitalsForm.temperature_celsius) : null,
        blood_pressure: vitalsForm.blood_pressure || null,
        pulse_bpm: vitalsForm.pulse_bpm ? Number(vitalsForm.pulse_bpm) : null,
        respiratory_rate: vitalsForm.respiratory_rate ? Number(vitalsForm.respiratory_rate) : null,
      })
      setVitalsForm({ weight_kg: '', temperature_celsius: '', blood_pressure: '', pulse_bpm: '', respiratory_rate: '' })
      const { data } = await api.get(`/appointments/${selectedId}/vitals`)
      setVitalsHistory(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer les constantes."))
    } finally {
      setSavingVitals(false)
    }
  }

  const selectedAppointment = appointments.find((a) => a.id === selectedId)

  return (
    <div>
      <p className="text-forest-700 text-sm mb-4">Rendez-vous du jour - marque l'arrivee et prends les constantes avant la consultation.</p>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {selectedId && (
        <div className="rounded-xl border border-forest-300 bg-forest-50 p-5 mb-6">
          <div className="flex justify-between items-start mb-3">
            <p className="font-display text-lg text-forest-900 font-semibold">{selectedAppointment?.patient_name}</p>
            <button onClick={() => setSelectedId(null)} className="text-sm text-forest-700 hover:text-forest-900 hover:underline">Fermer</button>
          </div>

          <div className="bg-white rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-forest-900 mb-2">Prendre les constantes</p>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <input type="number" step="0.1" placeholder="Poids (kg)" value={vitalsForm.weight_kg}
                onChange={(e) => setVitalsForm({ ...vitalsForm, weight_kg: e.target.value })}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
              <input type="number" step="0.1" placeholder="Temperature (°C)" value={vitalsForm.temperature_celsius}
                onChange={(e) => setVitalsForm({ ...vitalsForm, temperature_celsius: e.target.value })}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
              <input placeholder="Tension (ex: 120/80)" value={vitalsForm.blood_pressure}
                onChange={(e) => setVitalsForm({ ...vitalsForm, blood_pressure: e.target.value })}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
              <input type="number" placeholder="Pouls (bpm)" value={vitalsForm.pulse_bpm}
                onChange={(e) => setVitalsForm({ ...vitalsForm, pulse_bpm: e.target.value })}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            </div>
            <button onClick={submitVitals} disabled={savingVitals}
              className="rounded-full bg-amber-500 text-forest-900 px-5 py-1.5 text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50">
              {savingVitals ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>

          <p className="text-sm font-medium text-forest-900 mb-2">Historique</p>
          {loadingVitals && <p className="text-sm text-forest-700">Chargement...</p>}
          {!loadingVitals && vitalsHistory.length === 0 && <p className="text-sm text-forest-700">Aucune constante relevee pour ce rendez-vous.</p>}
          <div className="space-y-2">
            {vitalsHistory.map((v) => (
              <div key={v.id} className="bg-white rounded-lg p-3 text-sm">
                <p className="text-forest-700">{new Date(v.recorded_at).toLocaleString('fr-FR')} - {v.recorded_by_name}</p>
                <p className="text-forest-900">
                  {v.weight_kg !== null && `Poids: ${v.weight_kg}kg  `}
                  {v.temperature_celsius !== null && `Temp: ${v.temperature_celsius}°C  `}
                  {v.blood_pressure && `Tension: ${v.blood_pressure}  `}
                  {v.pulse_bpm !== null && `Pouls: ${v.pulse_bpm}bpm`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {appointments.length === 0 && <p className="text-forest-700">Aucun rendez-vous aujourd'hui.</p>}
        {appointments.map((a) => (
          <div key={a.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">{a.patient_name}</p>
              <p className="text-sm text-forest-700">
                {new Date(a.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - Dr {a.doctor_name}
              </p>
              <AppointmentStatusBadge status={a.status} />
            </div>
            <div className="flex gap-2 shrink-0 ml-3">
              {a.status === 'confirmed' && (
                <button onClick={() => markArrived(a.id)} disabled={arrivingId === a.id}
                  className="text-sm bg-forest-700 text-white px-4 py-1.5 rounded-full font-medium hover:bg-forest-900 transition disabled:opacity-50">
                  {arrivingId === a.id ? '...' : 'Marquer arrive'}
                </button>
              )}
              {a.status === 'arrived' && (
                <button onClick={() => openVitals(a.id)}
                  className="text-sm border border-amber-500 text-amber-600 px-4 py-1.5 rounded-full font-medium hover:bg-amber-50 transition">
                  Prendre les constantes
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
