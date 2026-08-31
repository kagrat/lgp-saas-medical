import { useEffect, useState } from 'react'
import { BedDouble, Clock, ClipboardCheck } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'
import MySchedule from '../components/MySchedule'
import AppointmentCheckIn from '../components/AppointmentCheckIn'
import SidebarLayout from '../components/SidebarLayout'

/**
 * NOUVEAU (hospitalisation, demande confirmee par M. Faustin): espace
 * infirmier(e) reel - liste des patients hospitalises actifs, releve des
 * constantes vitales.
 */
export default function DesktopNurseDashboard() {
  const [tab, setTab] = useState('patients')
  const [admissions, setAdmissions] = useState([])
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [vitalsForm, setVitalsForm] = useState({ temperature_celsius: '', blood_pressure: '', pulse_bpm: '', respiratory_rate: '', notes: '' })
  const [savingVitals, setSavingVitals] = useState(false)
  const [vitalsMessage, setVitalsMessage] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setError('')
    try {
      const { data } = await api.get('/admissions/establishment', { params: { admission_status: 'active' } })
      setAdmissions(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les hospitalisations en cours.'))
    }
  }

  async function openAdmission(id) {
    setSelectedId(id)
    setDetail(null)
    setLoadingDetail(true)
    setVitalsMessage('')
    setVitalsForm({ temperature_celsius: '', blood_pressure: '', pulse_bpm: '', respiratory_rate: '', notes: '' })
    try {
      const { data } = await api.get(`/admissions/${id}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger le dossier d'hospitalisation."))
    } finally {
      setLoadingDetail(false)
    }
  }

  async function submitVitals() {
    setSavingVitals(true)
    setVitalsMessage('')
    setError('')
    try {
      await api.post(`/admissions/${selectedId}/vitals`, {
        temperature_celsius: vitalsForm.temperature_celsius ? Number(vitalsForm.temperature_celsius) : null,
        blood_pressure: vitalsForm.blood_pressure || null,
        pulse_bpm: vitalsForm.pulse_bpm ? Number(vitalsForm.pulse_bpm) : null,
        respiratory_rate: vitalsForm.respiratory_rate ? Number(vitalsForm.respiratory_rate) : null,
        notes: vitalsForm.notes || null,
      })
      setVitalsMessage('Constantes enregistrees.')
      setVitalsForm({ temperature_celsius: '', blood_pressure: '', pulse_bpm: '', respiratory_rate: '', notes: '' })
      const { data } = await api.get(`/admissions/${selectedId}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer les constantes."))
    } finally {
      setSavingVitals(false)
    }
  }

  const tabs = [
    { id: 'arrivees', label: 'Arrivées du jour', icon: ClipboardCheck },
    { id: 'patients', label: 'Patients hospitalises', icon: BedDouble },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
  ]

  return (
    <SidebarLayout
      portalLabel="Portail Infirmier"
      title="Espace infirmier(ere)"
      subtitle="Consulte un patient pour relever ses constantes vitales, ou ton propre planning."
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setError('') }}
      accentColor="bg-primary-700"
    >
      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'schedule' && <MySchedule />}

      {tab === 'arrivees' && <AppointmentCheckIn />}

      {tab === 'patients' && (
        <div>
      {selectedId && (
        <div className="rounded-xl border border-forest-300 bg-forest-50 p-5 mb-6">
          {loadingDetail && <p className="text-sm text-forest-700">Chargement...</p>}
          {detail && (
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-display text-lg text-forest-900 font-semibold">{detail.patient_name}</p>
                  <p className="text-sm text-forest-700">
                    Dossier {detail.dossier_number} - {detail.department_name || 'Aucun departement'}{detail.room_name ? ` - ${detail.room_name}` : ''}
                  </p>
                  {detail.diagnosis && <p className="text-sm text-forest-700 mt-1">Diagnostic: {detail.diagnosis}</p>}
                </div>
                <button onClick={() => setSelectedId(null)} className="text-sm text-forest-700 hover:text-forest-900 hover:underline">
                  Fermer
                </button>
              </div>

              <div className="bg-white rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-forest-900 mb-2">Relever les constantes</p>
                {vitalsMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-3 text-sm">{vitalsMessage}</p>}
                <div className="grid sm:grid-cols-2 gap-3 mb-3">
                  <input type="number" step="0.1" placeholder="Temperature (°C)" value={vitalsForm.temperature_celsius}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, temperature_celsius: e.target.value })}
                    className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                  <input placeholder="Tension (ex: 120/80)" value={vitalsForm.blood_pressure}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, blood_pressure: e.target.value })}
                    className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                  <input type="number" placeholder="Pouls (bpm)" value={vitalsForm.pulse_bpm}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, pulse_bpm: e.target.value })}
                    className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                  <input type="number" placeholder="Frequence respiratoire" value={vitalsForm.respiratory_rate}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, respiratory_rate: e.target.value })}
                    className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                </div>
                <textarea placeholder="Notes (optionnel)" value={vitalsForm.notes}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                  rows={2} className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3" />
                <button onClick={submitVitals} disabled={savingVitals}
                  className="rounded-full bg-amber-500 text-forest-900 px-5 py-1.5 text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50">
                  {savingVitals ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>

              <p className="text-sm font-medium text-forest-900 mb-2">Historique des constantes</p>
              {detail.vital_signs.length === 0 && <p className="text-sm text-forest-700 mb-3">Aucune constante relevee pour le moment.</p>}
              <div className="space-y-2">
                {detail.vital_signs.map((v) => (
                  <div key={v.id} className="bg-white rounded-lg p-3 text-sm">
                    <p className="text-forest-700">
                      {new Date(v.recorded_at).toLocaleString('fr-FR')} - {v.recorded_by_name}
                    </p>
                    <p className="text-forest-900">
                      {v.temperature_celsius !== null && `Temp: ${v.temperature_celsius}°C  `}
                      {v.blood_pressure && `Tension: ${v.blood_pressure}  `}
                      {v.pulse_bpm !== null && `Pouls: ${v.pulse_bpm}bpm  `}
                      {v.respiratory_rate !== null && `FR: ${v.respiratory_rate}`}
                    </p>
                    {v.notes && <p className="text-forest-700 italic">{v.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {admissions.length === 0 && <p className="text-forest-700">Aucun patient hospitalise actuellement.</p>}
        {admissions.map((a) => (
          <button
            key={a.id}
            onClick={() => openAdmission(a.id)}
            className="w-full text-left rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center hover:border-forest-300 transition"
          >
            <div>
              <p className="text-forest-900 font-medium">{a.patient_name}</p>
              <p className="text-sm text-forest-700">
                Dossier {a.dossier_number} - {a.department_name || 'Aucun departement'}{a.room_name ? ` - ${a.room_name}` : ''}
              </p>
            </div>
            <p className="text-xs text-forest-700">Admis le {new Date(a.admission_date).toLocaleDateString('fr-FR')}</p>
          </button>
        ))}
      </div>
        </div>
      )}
    </SidebarLayout>
  )
}
