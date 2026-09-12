import { useEffect, useState } from 'react'
import { BedDouble, Clock, ClipboardCheck, MessageCircle } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'
import MySchedule from '../components/MySchedule'
import AppointmentCheckIn from '../components/AppointmentCheckIn'
import SidebarLayout from '../components/SidebarLayout'
import InternalMessaging from '../components/InternalMessaging'
import NotificationBell from '../components/NotificationBell'
import UserProfileBadge from '../components/UserProfileBadge'

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

  // NOUVEAU (lacune identifiee lors d'un audit complet): le type de
  // document "note infirmiere" existait deja mais aucune interface ne
  // permettait d'en creer un - dossier de soins distinct du dossier
  // medical du medecin, comme dans un vrai hopital.
  const [noteForm, setNoteForm] = useState({ title: '', content: '' })
  const [savingNote, setSavingNote] = useState(false)
  const [noteMessage, setNoteMessage] = useState('')

  // NOUVEAU (lacune identifiee lors d'un audit complet): aucun suivi
  // d'administration des medicaments n'existait pour un patient
  // hospitalise - pratique quasi universelle en milieu hospitalier reel.
  const [medForm, setMedForm] = useState({ medication_name: '', dosage: '', status: 'given', notes: '' })
  const [savingMed, setSavingMed] = useState(false)
  const [medMessage, setMedMessage] = useState('')

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
    setNoteForm({ title: '', content: '' })
    setNoteMessage('')
    setMedForm({ medication_name: '', dosage: '', status: 'given', notes: '' })
    setMedMessage('')
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

  async function submitNursingNote() {
    if (!noteForm.title || !noteForm.content) return
    setSavingNote(true)
    setNoteMessage('')
    setError('')
    try {
      await api.post(`/admissions/${selectedId}/nursing-note`, noteForm)
      setNoteMessage('Note de soins ajoutee au dossier.')
      setNoteForm({ title: '', content: '' })
      const { data } = await api.get(`/admissions/${selectedId}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter cette note."))
    } finally {
      setSavingNote(false)
    }
  }

  async function submitMedication() {
    if (!medForm.medication_name) return
    setSavingMed(true)
    setMedMessage('')
    setError('')
    try {
      await api.post(`/admissions/${selectedId}/medications`, medForm)
      setMedMessage('Administration enregistree.')
      setMedForm({ medication_name: '', dosage: '', status: 'given', notes: '' })
      const { data } = await api.get(`/admissions/${selectedId}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer cette administration."))
    } finally {
      setSavingMed(false)
    }
  }

  const tabs = [
    { id: 'arrivees', label: 'Arrivées du jour', icon: ClipboardCheck },
    { id: 'patients', label: 'Patients hospitalises', icon: BedDouble },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
    { id: 'internal-messages', label: 'Messagerie interne', icon: MessageCircle },
  ]

  return (
    <SidebarLayout
      portalLabel="Portail Infirmier"
      title="Espace infirmier(ere)"
      subtitle="Consulte un patient pour relever ses constantes vitales, ou ton propre planning."
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setError('') }}
      accentColor="bg-primary-500"
      headerRight={<div className="flex items-center gap-4"><NotificationBell /><UserProfileBadge /></div>}
    >
      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'schedule' && <MySchedule />}

      {tab === 'internal-messages' && <InternalMessaging />}

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
                  className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-semibold hover:brightness-90 transition disabled:opacity-50">
                  {savingVitals ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>

              <p className="text-sm font-medium text-forest-900 mb-2">Historique des constantes</p>
              {detail.vital_signs.length === 0 && <p className="text-sm text-forest-700 mb-3">Aucune constante relevee pour le moment.</p>}
              <div className="space-y-2 mb-4">
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

              {/* NOUVEAU (lacune identifiee lors d'un audit complet):
                  suivi d'administration des medicaments (MAR) - pratique
                  quasi universelle en milieu hospitalier reel, absente
                  jusqu'ici. */}
              <div className="bg-white rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-forest-900 mb-2">Administrer un medicament</p>
                {medMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-3 text-sm">{medMessage}</p>}
                <div className="grid sm:grid-cols-2 gap-2 mb-2">
                  <input placeholder="Nom du medicament" value={medForm.medication_name}
                    onChange={(e) => setMedForm({ ...medForm, medication_name: e.target.value })}
                    className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                  <input placeholder="Dose (ex: 1g, 500mg)" value={medForm.dosage}
                    onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                    className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
                </div>
                <select value={medForm.status} onChange={(e) => setMedForm({ ...medForm, status: e.target.value })}
                  className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white mb-2">
                  <option value="given">Administre</option>
                  <option value="held">Dose retenue (a la demande du medecin)</option>
                  <option value="refused">Refuse par le patient</option>
                </select>
                <input placeholder="Notes (optionnel)" value={medForm.notes}
                  onChange={(e) => setMedForm({ ...medForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3" />
                <button onClick={submitMedication} disabled={savingMed || !medForm.medication_name}
                  className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-semibold hover:brightness-90 transition disabled:opacity-50">
                  {savingMed ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>

              <p className="text-sm font-medium text-forest-900 mb-2">Historique des medicaments</p>
              {detail.medication_administrations.length === 0 && <p className="text-sm text-forest-700 mb-4">Aucun medicament administre pour le moment.</p>}
              <div className="space-y-2 mb-4">
                {detail.medication_administrations.map((m) => (
                  <div key={m.id} className={`rounded-lg p-3 text-sm ${m.status !== 'given' ? 'bg-clay-500/5 border border-clay-300' : 'bg-white'}`}>
                    <p className="text-forest-900 font-medium">
                      {m.medication_name}{m.dosage && ` - ${m.dosage}`}
                      {m.status === 'held' && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-clay-500/10 text-clay-600 font-medium">Dose retenue</span>}
                      {m.status === 'refused' && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-clay-500/10 text-clay-600 font-medium">Refuse</span>}
                    </p>
                    <p className="text-forest-700">{new Date(m.administered_at).toLocaleString('fr-FR')} - {m.administered_by_name}</p>
                    {m.notes && <p className="text-forest-700 italic">{m.notes}</p>}
                  </div>
                ))}
              </div>

              {/* NOUVEAU (lacune identifiee lors d'un audit complet):
                  dossier de soins infirmiers, distinct du dossier medical
                  du medecin - pratique universelle dans un vrai hopital. */}
              <div className="bg-white rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-forest-900 mb-2">Ajouter une note de soins</p>
                {noteMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-3 text-sm">{noteMessage}</p>}
                <input placeholder="Titre (ex: Soins du matin)" value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2" />
                <textarea placeholder="Observations, soins prodigues, etat du patient..." value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  rows={3} className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3" />
                <button onClick={submitNursingNote} disabled={savingNote || !noteForm.title || !noteForm.content}
                  className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 text-sm font-semibold hover:brightness-90 transition disabled:opacity-50">
                  {savingNote ? 'Enregistrement...' : 'Ajouter au dossier de soins'}
                </button>
              </div>

              <p className="text-sm font-medium text-forest-900 mb-2">Dossier (notes medicales et de soins)</p>
              {detail.documents.length === 0 && <p className="text-sm text-forest-700">Aucune note pour le moment.</p>}
              <div className="space-y-2">
                {detail.documents.map((d) => (
                  <div key={d.id} className="bg-white rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-forest-900 font-medium">{d.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.document_type === 'nursing_note' ? 'bg-primary-500/10 text-primary-700' : 'bg-secondary-500/10 text-secondary-600'}`}>
                        {d.document_type === 'nursing_note' ? 'Note de soins' : 'Note medicale'}
                      </span>
                    </div>
                    <p className="text-xs text-forest-700 mb-1">{d.doctor_name} - {new Date(d.created_at).toLocaleString('fr-FR')}</p>
                    <p className="text-forest-700">{d.content}</p>
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
