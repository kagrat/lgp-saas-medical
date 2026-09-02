import { useEffect, useState } from 'react'
import { Calendar, Users, BedDouble, Clock, MessageSquare, CalendarCheck } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'
import { AppointmentStatusBadge } from '../components/AppointmentStatusUI'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '../components/DocumentType'
import ChatWindow from '../components/ChatWindow'
import MyPatients from '../components/MyPatients'
import Hospitalizations from '../components/Hospitalizations'
import PrescriptionItemsEditor from '../components/PrescriptionItemsEditor'
import MySchedule from '../components/MySchedule'
import LabReferralForm from '../components/LabReferralForm'
import DoctorAvailabilityManager from '../components/DoctorAvailabilityManager'
import SidebarLayout from '../components/SidebarLayout'

export default function DesktopDoctorDashboard() {
  const [establishment, setEstablishment] = useState(null)
  const [myDoctorId, setMyDoctorId] = useState(null)
  const [tab, setTab] = useState('appointments')
  const [appointments, setAppointments] = useState([])
  const [conversations, setConversations] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [error, setError] = useState('')

  const [completingId, setCompletingId] = useState(null)
  const [arrivingId, setArrivingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [reschedulingId, setReschedulingId] = useState(null)
  const [rescheduleValue, setRescheduleValue] = useState('')
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null)
  const [vitalsAppointmentId, setVitalsAppointmentId] = useState(null)
  const [vitalsData, setVitalsData] = useState([])
  const [loadingVitals, setLoadingVitals] = useState(false)
  const [docForm, setDocForm] = useState({ document_type: 'consultation_note', title: '', content: '' })
  const [prescriptionItems, setPrescriptionItems] = useState([])
  const [savingDoc, setSavingDoc] = useState(false)
  const [docMessage, setDocMessage] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    loadEstablishment()
    loadMyDoctorProfile()
  }, [])

  useEffect(() => {
    loadAppointments()
  }, [showCompleted])

  useEffect(() => {
    if (tab === 'messages') loadConversations()
  }, [tab])

  async function loadEstablishment() {
    try {
      const { data } = await api.get('/establishments/me')
      setEstablishment(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger les informations de l'établissement."))
    }
  }

  async function loadMyDoctorProfile() {
    try {
      const { data } = await api.get('/doctors/me')
      setMyDoctorId(data.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger ton profil médecin.'))
    }
  }

  async function loadAppointments() {
    try {
      const { data } = await api.get('/appointments/establishment', { params: { include_completed: showCompleted } })
      setAppointments(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger tes rendez-vous.'))
    }
  }

  async function loadConversations() {
    try {
      const { data } = await api.get('/messages/establishment/patients')
      setConversations(data)
      if (data.length > 0 && !selectedPatientId) setSelectedPatientId(data[0].patient_id)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les conversations.'))
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

  function toggleAppointmentExpand(appointmentId) {
    setExpandedAppointmentId(expandedAppointmentId === appointmentId ? null : appointmentId)
    setDocMessage('')
    setDocForm({ document_type: 'consultation_note', title: '', content: '' })
  }

  async function toggleVitals(appointmentId) {
    if (vitalsAppointmentId === appointmentId) {
      setVitalsAppointmentId(null)
      return
    }
    setVitalsAppointmentId(appointmentId)
    setLoadingVitals(true)
    try {
      const { data } = await api.get(`/appointments/${appointmentId}/vitals`)
      setVitalsData(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les constantes.'))
    } finally {
      setLoadingVitals(false)
    }
  }

  async function submitDocument(appointmentId) {
    setSavingDoc(true)
    setDocMessage('')
    setError('')
    try {
      const validItems = prescriptionItems.filter((it) => it.medication_name.trim())
      await api.post('/health-records', {
        appointment_id: appointmentId,
        document_type: docForm.document_type,
        title: docForm.title,
        content: docForm.content,
        prescription_items: docForm.document_type === 'prescription' && validItems.length > 0
          ? validItems.map((it) => ({ medication_name: it.medication_name, quantity: Number(it.quantity) || 1, dosage_instructions: it.dosage_instructions || null }))
          : null,
      })
      setDocMessage('Ajoute au dossier de sante du patient.')
      setDocForm({ document_type: 'consultation_note', title: '', content: '' })
      setPrescriptionItems([])
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce document au dossier."))
    } finally {
      setSavingDoc(false)
    }
  }

  const tabs = [
    { id: 'appointments', label: 'Mes rendez-vous', icon: Calendar },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'hospitalizations', label: 'Hospitalisations', icon: BedDouble },
    { id: 'availability', label: 'Ma disponibilité', icon: CalendarCheck },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
  ]

  const selectedConversation = conversations.find((c) => c.patient_id === selectedPatientId)

  return (
    <SidebarLayout
      portalLabel="Portail Médecin"
      title={establishment ? establishment.name : 'Chargement...'}
      subtitle="Ton espace médecin - tes rendez-vous et tes patients uniquement."
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setError('') }}
      accentColor="bg-secondary-500"
    >
      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'appointments' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-forest-700">
              Les rendez-vous termines ne s'affichent plus ici par defaut - retrouve tes patients et leur dossier dans l'onglet "Patients".
            </p>
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="text-xs text-amber-600 font-medium hover:underline shrink-0 ml-3"
            >
              {showCompleted ? 'Masquer les termines' : 'Afficher aussi les termines'}
            </button>
          </div>
          {appointments.length === 0 && <p className="text-forest-700">Aucun rendez-vous.</p>}
          {appointments.map((a) => (
            <div key={a.id} className="rounded-xl border border-forest-100 bg-white p-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <p className="text-forest-900 font-medium">{a.patient_name}</p>
                  <p className="text-sm text-forest-700">{new Date(a.scheduled_at).toLocaleString('fr-FR')}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <AppointmentStatusBadge status={a.status} />
                  <button
                    onClick={() => toggleVitals(a.id)}
                    className="text-sm rounded-full border border-secondary-500 text-secondary-600 px-4 py-1.5 hover:bg-forest-50 transition"
                  >
                    {vitalsAppointmentId === a.id ? 'Fermer' : 'Constantes'}
                  </button>
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
                  {a.status === 'completed' && (
                    <button
                      onClick={() => toggleAppointmentExpand(a.id)}
                      className="text-sm rounded-full border border-forest-300 px-4 py-1.5 hover:bg-forest-50 transition"
                    >
                      {expandedAppointmentId === a.id ? 'Fermer' : 'Ajouter au dossier'}
                    </button>
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

              {vitalsAppointmentId === a.id && (
                <div className="mt-4 pt-4 border-t border-forest-100">
                  {loadingVitals && <p className="text-sm text-forest-700">Chargement...</p>}
                  {!loadingVitals && vitalsData.length === 0 && (
                    <p className="text-sm text-forest-700">Aucune constante relevee pour ce rendez-vous.</p>
                  )}
                  <div className="space-y-2">
                    {vitalsData.map((v) => (
                      <div key={v.id} className="bg-forest-50 rounded-lg p-3 text-sm">
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

              {expandedAppointmentId === a.id && (
                <div className="mt-4 pt-4 border-t border-forest-100">
                  {docMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-xl p-3 mb-3 text-sm">{docMessage}</p>}
                  <div className="grid sm:grid-cols-2 gap-3 mb-3">
                    <select
                      value={docForm.document_type}
                      onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })}
                      className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white"
                    >
                      {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
                    </select>
                    <input
                      placeholder="Titre (ex: Ordonnance du 21 mai)"
                      value={docForm.title}
                      onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                      className="rounded-lg border border-forest-100 px-3 py-2 text-sm"
                    />
                  </div>
                  {docForm.document_type === 'prescription' && (
                    <PrescriptionItemsEditor items={prescriptionItems} onChange={setPrescriptionItems} />
                  )}
                  <textarea
                    placeholder="Contenu (traitement prescrit, résultat, observations...)"
                    value={docForm.content}
                    onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3"
                  />
                  <button
                    onClick={() => submitDocument(a.id)}
                    disabled={savingDoc || !docForm.title || !docForm.content}
                    className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-semibold hover:brightness-90 transition disabled:opacity-50"
                  >
                    {savingDoc ? 'Ajout...' : 'Ajouter au dossier du patient'}
                  </button>

                  <LabReferralForm appointmentId={a.id} onDone={() => {}} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'patients' && <MyPatients />}

      {tab === 'hospitalizations' && <Hospitalizations />}

      {tab === 'availability' && (
        myDoctorId ? <DoctorAvailabilityManager doctorId={myDoctorId} /> : <p className="text-forest-700">Chargement...</p>
      )}

      {tab === 'schedule' && <MySchedule />}

      {tab === 'messages' && (
        <div>
          {conversations.length === 0 ? (
            <p className="text-forest-700">Aucune conversation pour le moment.</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                {conversations.map((c) => (
                  <button
                    key={c.patient_id}
                    onClick={() => setSelectedPatientId(c.patient_id)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      selectedPatientId === c.patient_id
                        ? 'border-forest-700 bg-forest-50'
                        : 'border-forest-100 bg-white hover:bg-forest-50'
                    }`}
                  >
                    <p className="text-forest-900 font-medium text-sm">{c.patient_name}</p>
                    {c.last_message && <p className="text-xs text-forest-700 truncate">{c.last_message}</p>}
                  </button>
                ))}
              </div>
              <div className="sm:col-span-2">
                {selectedConversation && (
                  <ChatWindow
                    key={selectedConversation.patient_id}
                    fetchUrl={`/messages/establishment/conversation/${selectedConversation.patient_id}`}
                    sendUrl={`/messages/establishment/conversation/${selectedConversation.patient_id}`}
                    currentSenderRole="staff"
                    title={selectedConversation.patient_name}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </SidebarLayout>
  )
}
