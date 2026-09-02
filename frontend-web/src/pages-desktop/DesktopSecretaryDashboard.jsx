import { useEffect, useState } from 'react'
import { Calendar, Users, Clock, UserPlus } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'
import { AppointmentStatusBadge } from '../components/AppointmentStatusUI'
import FilterTabs from '../components/FilterTabs'
import PatientDirectory from '../components/PatientDirectory'
import WalkInPatientForm from '../components/WalkInPatientForm'
import CompleteRegistrationForm from '../components/CompleteRegistrationForm'
import MySchedule from '../components/MySchedule'
import SidebarLayout from '../components/SidebarLayout'

export default function DesktopSecretaryDashboard() {
  const [establishment, setEstablishment] = useState(null)
  const [tab, setTab] = useState('appointments')
  const [appointments, setAppointments] = useState([])
  const [appointmentFilter, setAppointmentFilter] = useState('all')
  const [error, setError] = useState('')

  const [completingId, setCompletingId] = useState(null)
  const [arrivingId, setArrivingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [reschedulingId, setReschedulingId] = useState(null)
  const [rescheduleValue, setRescheduleValue] = useState('')

  useEffect(() => {
    loadEstablishment()
    loadAppointments()
  }, [])

  async function loadEstablishment() {
    try {
      const { data } = await api.get('/establishments/me')
      setEstablishment(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger les informations de l'établissement."))
    }
  }

  async function loadAppointments() {
    try {
      const { data } = await api.get('/appointments/establishment')
      setAppointments(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les rendez-vous.'))
    }
  }

  async function markArrived(appointmentId) {
    setArrivingId(appointmentId)
    setError('')
    try {
      await api.post(`/appointments/${appointmentId}/arrive`)
      await loadAppointments()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de marquer ce rendez-vous comme arrive."))
    } finally {
      setArrivingId(null)
    }
  }

  async function markCompleted(appointmentId) {
    setCompletingId(appointmentId)
    setError('')
    try {
      await api.post(`/appointments/${appointmentId}/complete`)
      await loadAppointments()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de marquer ce rendez-vous comme termine."))
    } finally {
      setCompletingId(null)
    }
  }

  async function cancelAppointment(appointmentId) {
    setCancellingId(appointmentId)
    setError('')
    try {
      await api.post(`/appointments/${appointmentId}/cancel`)
      await loadAppointments()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'annuler ce rendez-vous."))
    } finally {
      setCancellingId(null)
    }
  }

  function toggleReschedule(appointmentId) {
    setReschedulingId(reschedulingId === appointmentId ? null : appointmentId)
    setRescheduleValue('')
  }

  async function submitReschedule(appointmentId) {
    if (!rescheduleValue) return
    setError('')
    try {
      await api.patch(`/appointments/${appointmentId}/reschedule`, {
        new_scheduled_at: new Date(rescheduleValue).toISOString(),
      })
      setReschedulingId(null)
      await loadAppointments()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de reporter ce rendez-vous.'))
    }
  }

  const tabs = [
    { id: 'appointments', label: 'Rendez-vous', icon: Calendar },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'nouveau-patient', label: 'Nouveau patient', icon: UserPlus },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
  ]

  const appointmentFilterOptions = [
    { value: 'all', label: 'Tous' },
    { value: 'confirmed', label: 'Confirmes' },
    { value: 'arrived', label: 'Arrives' },
    { value: 'completed', label: 'Terminés' },
    { value: 'cancelled', label: 'Annules' },
  ]
  const filteredAppointments = appointmentFilter === 'all' ? appointments : appointments.filter((a) => a.status === appointmentFilter)

  return (
    <SidebarLayout
      portalLabel="Portail Secrétariat"
      title={establishment ? establishment.name : 'Chargement...'}
      subtitle="Tous les rendez-vous de l'établissement."
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setError('') }}
      accentColor="bg-primary-500"
    >
      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'appointments' && (
        <div>
          <FilterTabs options={appointmentFilterOptions} active={appointmentFilter} onChange={setAppointmentFilter} />
          <div className="space-y-2">
            {filteredAppointments.length === 0 && <p className="text-forest-700">Aucun rendez-vous dans cette catégorie.</p>}
            {filteredAppointments.map((a) => (
              <div key={a.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <p className="text-forest-900 font-medium">{a.patient_name}</p>
                    <p className="text-sm text-forest-700">{new Date(a.scheduled_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <AppointmentStatusBadge status={a.status} />
                    {a.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => markArrived(a.id)}
                          disabled={arrivingId === a.id}
                          className="text-sm rounded-full border border-forest-300 px-4 py-1.5 hover:bg-forest-50 transition disabled:opacity-50"
                        >
                          {arrivingId === a.id ? '...' : 'Marquer arrive'}
                        </button>
                        <button
                          onClick={() => toggleReschedule(a.id)}
                          className="text-sm rounded-full border border-amber-400 text-amber-600 px-4 py-1.5 hover:bg-amber-50 transition"
                        >
                          Reporter
                        </button>
                      </>
                    )}
                    {(a.status === 'confirmed' || a.status === 'arrived') && (
                      <>
                        <button
                          onClick={() => markCompleted(a.id)}
                          disabled={completingId === a.id}
                          className="text-sm rounded-full bg-[var(--portal-accent)] text-white px-4 py-1.5 hover:brightness-90 transition disabled:opacity-50"
                        >
                          {completingId === a.id ? 'Mise a jour...' : 'Marquer termine'}
                        </button>
                        <button
                          onClick={() => cancelAppointment(a.id)}
                          disabled={cancellingId === a.id}
                          className="text-sm rounded-full border border-clay-500 text-clay-600 px-4 py-1.5 hover:bg-clay-500 hover:text-white transition disabled:opacity-50"
                        >
                          {cancellingId === a.id ? '...' : 'Annuler'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {reschedulingId === a.id && (
                  <div className="mt-3 pt-3 border-t border-forest-100 flex flex-wrap gap-2 items-end">
                    <div>
                      <label className="block text-xs text-forest-700 mb-1">Nouvelle date et heure</label>
                      <input type="datetime-local" value={rescheduleValue}
                        onChange={(e) => setRescheduleValue(e.target.value)}
                        className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm" />
                    </div>
                    <button onClick={() => submitReschedule(a.id)}
                      className="rounded-full bg-[var(--portal-accent)] text-white px-4 py-1.5 text-sm font-semibold hover:brightness-90 transition">
                      Confirmer le report
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'patients' && <PatientDirectory />}

      {tab === 'nouveau-patient' && (
        <div className="space-y-6">
          <WalkInPatientForm />
          <CompleteRegistrationForm />
        </div>
      )}

      {tab === 'schedule' && <MySchedule />}
    </SidebarLayout>
  )
}
