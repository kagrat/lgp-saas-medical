import { useEffect, useState } from 'react'
import api from '../api/client'

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([])
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState(null)

  useEffect(() => {
    loadAppointments()
  }, [])

  async function loadAppointments() {
    try {
      const { data } = await api.get('/appointments/mine')
      setAppointments(data)
    } catch (err) {
      setError('Impossible de charger tes rendez-vous.')
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
