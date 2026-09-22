import { useEffect, useState } from 'react'
import { Calendar, Users, BedDouble, Clock, MessageSquare, MessageCircle, Star } from 'lucide-react'
import api, { getErrorMessage } from '../api/client'
import { AppointmentStatusBadge } from '../components/AppointmentStatusUI'
import { SELECTABLE_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '../components/DocumentType'
import ChatWindow from '../components/ChatWindow'
import StartConversation from '../components/StartConversation'
import InternalMessaging from '../components/InternalMessaging'
import AdmitPatientShortcut from '../components/AdmitPatientShortcut'
import UserProfileBadge from '../components/UserProfileBadge'
import QuickMessageBox from '../components/QuickMessageBox'
import ExternalReferralForm from '../components/ExternalReferralForm'
import MyPatients from '../components/MyPatients'
import Hospitalizations from '../components/Hospitalizations'
import PrescriptionItemsEditor from '../components/PrescriptionItemsEditor'
import MySchedule from '../components/MySchedule'
import LabReferralForm from '../components/LabReferralForm'
import DoctorReviewsList from '../components/DoctorReviewsList'
import NotificationBell from '../components/NotificationBell'
import SidebarLayout from '../components/SidebarLayout'

export default function DesktopDoctorDashboard() {
  const [establishment, setEstablishment] = useState(null)
  const [myDoctorId, setMyDoctorId] = useState(null)
  const [tab, setTab] = useState('appointments')
  const [appointments, setAppointments] = useState([])
  const [conversations, setConversations] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [selectedPatientName, setSelectedPatientName] = useState(null)
  const [error, setError] = useState('')

  const [completingId, setCompletingId] = useState(null)
  const [arrivingId, setArrivingId] = useState(null)
  const [reschedulingId, setReschedulingId] = useState(null)
  const [rescheduleValue, setRescheduleValue] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState(null)
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false)
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null)
  // NOUVEAU (demande explicite de M. Faustin, capture jointe: "apres
  // avoir termine la consultation, le medecin doit avoir acces aux
  // options qui apparaissent lorsqu'on affiche le dossier patient" -
  // memes onglets riches Consultation/Historique/Documents/Messages
  // qu'au niveau "Mes patients", directement depuis la liste des RDV).
  const [dossierPatientId, setDossierPatientId] = useState(null)
  const [dossierDetail, setDossierDetail] = useState(null)
  const [dossierLoading, setDossierLoading] = useState(false)
  const [dossierTab, setDossierTab] = useState('consultation')
  const [dossierConversation, setDossierConversation] = useState(null)
  const [dossierConversationContent, setDossierConversationContent] = useState('')
  const [dossierSendingMessage, setDossierSendingMessage] = useState(false)
  const [transferringId, setTransferringId] = useState(null)
  const [colleagues, setColleagues] = useState(null)
  const [loadingColleagues, setLoadingColleagues] = useState(false)
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


  function toggleReschedule(appointmentId) {
    setReschedulingId(reschedulingId === appointmentId ? null : appointmentId)
    setRescheduleValue('')
    setRescheduleDate('')
    setRescheduleSlots(null)
  }

  async function checkRescheduleSlots(e) {
    if (e) e.preventDefault()
    if (!rescheduleDate || !myDoctorId) return
    setLoadingRescheduleSlots(true)
    setError('')
    try {
      const { data } = await api.get('/appointments/available-slots', {
        params: { doctor_id: myDoctorId, target_date: rescheduleDate },
      })
      setRescheduleSlots(data.slots)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les creneaux libres.'))
    } finally {
      setLoadingRescheduleSlots(false)
    }
  }

  async function submitReschedule(appointmentId, newDateTime) {
    setError('')
    try {
      await api.patch(`/appointments/${appointmentId}/reschedule`, {
        new_scheduled_at: newDateTime,
      })
      setReschedulingId(null)
      setRescheduleSlots(null)
      await loadAppointments()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de reporter ce rendez-vous.'))
    }
  }

  async function toggleTransfer(appointmentId) {
    if (transferringId === appointmentId) {
      setTransferringId(null)
      setColleagues(null)
      return
    }
    setTransferringId(appointmentId)
    setColleagues(null)
    setLoadingColleagues(true)
    try {
      const { data } = await api.get('/doctors/search', { params: { establishment_id: establishment?.id } })
      setColleagues(data.filter((d) => d.id !== myDoctorId))
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger la liste des collegues.'))
    } finally {
      setLoadingColleagues(false)
    }
  }

  async function submitTransfer(appointmentId, newDoctorId) {
    setError('')
    try {
      await api.patch(`/appointments/${appointmentId}/transfer`, { new_doctor_id: newDoctorId })
      setTransferringId(null)
      setColleagues(null)
      await loadAppointments()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de transferer ce rendez-vous.'))
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

  async function openFullDossier(patientId) {
    if (dossierPatientId === patientId) {
      setDossierPatientId(null)
      setDossierDetail(null)
      return
    }
    setDossierPatientId(patientId)
    setDossierDetail(null)
    setDossierTab('consultation')
    setDossierConversation(null)
    try {
      const { data } = await api.get(`/doctors/me/patients/${patientId}`)
      setDossierDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le dossier complet.'))
    }
  }

  async function loadDossierConversation() {
    try {
      const { data } = await api.get(`/messages/establishment/conversation/${dossierPatientId}`)
      setDossierConversation(data)
    } catch (err) {
      setDossierConversation([])
    }
  }

  async function sendDossierMessage(e) {
    e.preventDefault()
    if (!dossierConversationContent.trim()) return
    setDossierSendingMessage(true)
    try {
      await api.post(`/messages/establishment/conversation/${dossierPatientId}`, { content: dossierConversationContent })
      setDossierConversationContent('')
      await loadDossierConversation()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'envoyer ce message."))
    } finally {
      setDossierSendingMessage(false)
    }
  }

  const tabs = [
    { id: 'appointments', label: 'Mes rendez-vous', icon: Calendar },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'hospitalizations', label: 'Hospitalisations', icon: BedDouble },
    // CORRIGE (demande explicite de M. Faustin: "c'est DRH ou l'ETS qui
    // doivent programmer la disponibilite des medecins, faut supprimer
    // 'ma disponibilite'"). En attendant que cette gestion soit
    // entierement cote DRH/ETS, le medecin programme ses gardes via
    // "Mon planning" a la place (voir MySchedule.jsx).
    { id: 'reviews', label: 'Mes avis', icon: Star },
    { id: 'schedule', label: 'Mon planning', icon: Clock },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'internal-messages', label: 'Messagerie interne', icon: MessageCircle },
  ]

  const selectedConversation = conversations.find((c) => c.patient_id === selectedPatientId)
    || (selectedPatientId && selectedPatientName ? { patient_id: selectedPatientId, patient_name: selectedPatientName } : null)

  return (
    <SidebarLayout
      portalLabel="Portail Médecin"
      title={establishment ? establishment.name : 'Chargement...'}
      subtitle="Ton espace médecin - tes rendez-vous et tes patients uniquement."
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => { setTab(id); setError('') }}
      accentColor="bg-secondary-500"
      headerRight={<div className="flex items-center gap-4"><NotificationBell /><UserProfileBadge /></div>}
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

          {/* CORRIGE (demande explicite de M. Faustin: "Faut classer les
              informations: Nom du patient, Numero de dossier, Date du
              RDV, HEURE DU RDV et option Ouvrir") - avant, la date et
              l'heure etaient fusionnees et le numero de dossier place en
              dernier, dans un ordre different de sa demande. Ligne
              d'entete + colonnes alignees, meme principe deja applique
              cote pharmacie pour rester coherent dans tout le systeme. */}
          {appointments.length > 0 && (
            <div className="hidden sm:grid sm:grid-cols-[1.5fr_1fr_1fr_0.8fr_auto_auto] gap-3 px-4 py-2 text-xs font-medium text-forest-700 uppercase tracking-wide">
              <span>Nom du patient</span>
              <span>N° de dossier</span>
              <span>Date</span>
              <span>Heure</span>
              <span>Statut</span>
              <span>Action</span>
            </div>
          )}

          {appointments.map((a) => (
            <div key={a.id} className="rounded-xl border border-forest-100 bg-white p-4">
              <div className="grid sm:grid-cols-[1.5fr_1fr_1fr_0.8fr_auto_auto] gap-3 items-center">
                <span className="text-forest-900 font-medium">{a.patient_name}</span>
                <span className="text-sm text-forest-700">{a.dossier_number || '—'}</span>
                <span className="text-sm text-forest-700">{new Date(a.scheduled_at).toLocaleDateString('fr-FR')}</span>
                <span className="text-sm text-forest-700">{new Date(a.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <AppointmentStatusBadge status={a.status} />
                <button
                  onClick={() => setExpandedAppointmentId(expandedAppointmentId === a.id ? null : a.id)}
                  className="text-sm rounded-full bg-[var(--portal-accent)] text-white px-5 py-1.5 hover:brightness-90 transition justify-self-start sm:justify-self-end"
                >
                  {expandedAppointmentId === a.id ? 'Fermer' : 'Ouvrir'}
                </button>
              </div>

              {expandedAppointmentId === a.id && (
                <div className="mt-3 pt-3 border-t border-forest-100 space-y-3">
                  {/* CORRIGE (demande explicite de M. Faustin, capture
                      jointe: "organiser de maniere esthetique le reste
                      des options") - avant, tous les boutons etaient
                      alignes en vrac avec des couleurs differentes sans
                      logique. Regroupes maintenant par intention:
                      "Actions" (fait avancer le rendez-vous) puis
                      "Outils" (utilises pendant la consultation). */}
                  <div>
                    <p className="text-xs font-medium text-forest-700 uppercase tracking-wide mb-1.5">Actions</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.status === 'confirmed' && (
                        <button
                          onClick={() => markArrived(a.id)}
                          disabled={arrivingId === a.id}
                          className="text-sm rounded-full border border-forest-300 text-forest-900 px-4 py-1.5 hover:bg-forest-50 transition disabled:opacity-50"
                        >
                          {arrivingId === a.id ? '...' : 'Marquer arrivé'}
                        </button>
                      )}
                      {(a.status === 'confirmed' || a.status === 'arrived') && (
                        <button
                          onClick={() => markCompleted(a.id)}
                          disabled={completingId === a.id}
                          className="text-sm rounded-full bg-[var(--portal-accent)] text-white px-4 py-1.5 hover:brightness-90 transition disabled:opacity-50"
                        >
                          {completingId === a.id ? 'Mise à jour...' : 'Marquer terminé'}
                        </button>
                      )}
                      {a.status === 'confirmed' && (
                        <>
                          <button
                            onClick={() => toggleReschedule(a.id)}
                            className="text-sm rounded-full border border-forest-300 text-forest-700 px-4 py-1.5 hover:bg-forest-50 transition"
                          >
                            Reporter
                          </button>
                          <button
                            onClick={() => toggleTransfer(a.id)}
                            className="text-sm rounded-full border border-forest-300 text-forest-700 px-4 py-1.5 hover:bg-forest-50 transition"
                          >
                            Transférer à un collègue
                          </button>
                        </>
                      )}
                      {/* NOUVEAU (demande explicite de M. Faustin:
                          "reorienter vers un medecin externe si
                          l'hopital ne dispose pas en interne"). */}
                      {(a.status === 'confirmed' || a.status === 'arrived') && (
                        <ExternalReferralForm patientId={a.patient_id} />
                      )}
                      {/* CORRIGE (demande explicite de M. Faustin: "le
                          medecin ne doit pas annuler les RDV, il peut
                          soit traiter soit reorienter vers un autre
                          medecin interne ou externe") - bouton Annuler
                          retire du portail medecin. Reste disponible
                          cote etablissement/reception, qui gardent la
                          responsabilite administrative d'un RDV annule. */}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-forest-700 uppercase tracking-wide mb-1.5">Outils</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => toggleVitals(a.id)}
                        className="text-sm rounded-full border border-forest-300 text-forest-700 px-4 py-1.5 hover:bg-forest-50 transition"
                      >
                        {vitalsAppointmentId === a.id ? 'Fermer les constantes' : 'Constantes'}
                      </button>
                      {/* CORRIGE (audit complet: envoyer un message
                          directement depuis la consultation). */}
                      <QuickMessageBox patientId={a.patient_id} />
                      {(a.status === 'confirmed' || a.status === 'arrived') && (
                        <AdmitPatientShortcut patientId={a.patient_id} patientName={a.patient_name} onAdmitted={loadAppointments} />
                      )}
                      {/* NOUVEAU (demande explicite de M. Faustin, capture
                          jointe: "apres avoir termine la consultation, le
                          medecin doit avoir acces aux options qui
                          apparaissent lorsqu'on affiche le dossier
                          patient" - memes onglets qu'au niveau "Mes
                          patients": Consultation/Historique/Documents/Messages). */}
                      {a.status === 'completed' && (
                        <button
                          onClick={() => openFullDossier(a.patient_id)}
                          className="text-sm rounded-full border border-forest-300 text-forest-700 px-4 py-1.5 hover:bg-forest-50 transition"
                        >
                          {dossierPatientId === a.patient_id ? 'Fermer le dossier' : 'Voir le dossier complet'}
                        </button>
                      )}
                    </div>
                  </div>

                  {dossierPatientId === a.patient_id && (
                    <div className="mt-3 rounded-xl border border-forest-300 bg-white overflow-hidden">
                      {dossierDetail === null ? (
                        <p className="text-sm text-forest-700 p-5">Chargement...</p>
                      ) : (
                        <div>
                          <div className="flex gap-1 px-5 border-b border-forest-100">
                            {[
                              { id: 'consultation', label: 'Consultation' },
                              { id: 'historique', label: 'Historique' },
                              { id: 'documents', label: 'Documents' },
                              { id: 'messages', label: 'Messages' },
                            ].map((t) => (
                              <button
                                key={t.id}
                                onClick={() => { setDossierTab(t.id); if (t.id === 'messages' && dossierConversation === null) loadDossierConversation() }}
                                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${dossierTab === t.id ? 'border-secondary-500 text-forest-900' : 'border-transparent text-forest-700 hover:text-forest-900'}`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                          <div className="p-5">
                            {dossierTab === 'consultation' && (
                              <div>
                                <p className="text-sm font-medium text-forest-900 mb-2">Éléments cliniques</p>
                                {dossierDetail.clinical_flags.length === 0 ? (
                                  <p className="text-sm text-forest-700 mb-4">Aucun élément clinique renseigné.</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2 mb-4">
                                    {dossierDetail.clinical_flags.map((f) => (
                                      <span key={f.id} className="text-xs px-3 py-1 rounded-full bg-forest-50 text-forest-900">{f.label}</span>
                                    ))}
                                  </div>
                                )}
                                <p className="text-xs text-forest-500">Pour ajouter une note ou une ordonnance, utilise "Ajouter au dossier" ci-dessus.</p>
                              </div>
                            )}
                            {dossierTab === 'historique' && (
                              <div>
                                <p className="text-sm font-medium text-forest-900 mb-2">Consultations passées</p>
                                {dossierDetail.appointments.length === 0 && <p className="text-sm text-forest-700">Aucune consultation enregistrée.</p>}
                                <div className="space-y-2">
                                  {dossierDetail.appointments.map((ap) => (
                                    <div key={ap.id} className="bg-forest-50 rounded-lg p-3 text-sm text-forest-900">
                                      {new Date(ap.scheduled_at).toLocaleString('fr-FR')}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {dossierTab === 'documents' && (
                              <div>
                                <p className="text-sm font-medium text-forest-900 mb-2">Documents du dossier</p>
                                {dossierDetail.documents.length === 0 && <p className="text-sm text-forest-700">Aucun document pour le moment.</p>}
                                <div className="space-y-2">
                                  {dossierDetail.documents.map((d) => (
                                    <div key={d.id} className="bg-forest-50 rounded-lg p-3">
                                      <p className="text-sm font-medium text-forest-900">{d.title}</p>
                                      <p className="text-xs text-forest-700 mb-1">{new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
                                      <p className="text-sm text-forest-700 whitespace-pre-wrap">{d.content}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {dossierTab === 'messages' && (
                              <div>
                                {dossierConversation === null ? (
                                  <p className="text-sm text-forest-700">Chargement...</p>
                                ) : (
                                  <div className="rounded-xl border border-forest-100 bg-white flex flex-col h-[320px]">
                                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                      {dossierConversation.length === 0 && <p className="text-sm text-forest-700">Aucun message pour le moment.</p>}
                                      {dossierConversation.map((m) => (
                                        <div key={m.id} className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_role === 'patient' ? 'bg-forest-50 text-forest-900' : 'bg-[var(--portal-accent)] text-white ml-auto'}`}>
                                          {m.content}
                                        </div>
                                      ))}
                                    </div>
                                    <form onSubmit={sendDossierMessage} className="p-3 border-t border-forest-100 flex gap-2">
                                      <input value={dossierConversationContent} onChange={(e) => setDossierConversationContent(e.target.value)}
                                        placeholder="Écrire au patient..."
                                        className="flex-1 rounded-full border border-forest-100 px-4 py-2 text-sm" />
                                      <button type="submit" disabled={dossierSendingMessage || !dossierConversationContent.trim()}
                                        className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
                                        Envoyer
                                      </button>
                                    </form>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {transferringId === a.id && (
                    <div className="mt-3 pt-3 border-t border-forest-100">
                      <p className="text-sm font-medium text-forest-900 mb-2">Transferer a un collegue</p>
                      {loadingColleagues && <p className="text-sm text-forest-700">Chargement...</p>}
                      {colleagues && colleagues.length === 0 && <p className="text-sm text-forest-700">Aucun autre medecin dans cet etablissement.</p>}
                      {colleagues && colleagues.length > 0 && (
                        <div className="grid sm:grid-cols-2 gap-2">
                          {colleagues.map((doc) => (
                            <button key={doc.id} onClick={() => submitTransfer(a.id, doc.id)}
                              className="text-left rounded-lg border border-forest-100 p-2 text-sm hover:border-forest-300 transition">
                              {doc.full_name} <span className="text-xs text-forest-700">({doc.specialty})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {reschedulingId === a.id && (
                <div className="mt-3 pt-3 border-t border-forest-100">
                  {/* NOUVEAU (demande explicite de M. Faustin: "le medecin
                      pourra reporter un rendez-vous... sur ces
                      disponibilites dans les semaines a venir") - avant,
                      le medecin tapait une date/heure a l'aveugle, sans
                      voir si le creneau etait meme libre. Reutilise le
                      meme mecanisme deja teste (tous les creneaux
                      reellement libres, pas de limite de date). */}
                  <form onSubmit={checkRescheduleSlots} className="flex items-end gap-2 mb-3">
                    <div>
                      <label className="block text-xs text-forest-700 mb-1">Nouvelle date</label>
                      <input type="date" required value={rescheduleDate} min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm" />
                    </div>
                    <button type="submit" disabled={loadingRescheduleSlots}
                      className="rounded-full border border-forest-300 px-4 py-1.5 text-sm hover:bg-forest-50 transition disabled:opacity-50">
                      {loadingRescheduleSlots ? '...' : 'Voir les creneaux libres'}
                    </button>
                  </form>

                  {rescheduleSlots && (
                    rescheduleSlots.length === 0 ? (
                      <p className="text-sm text-forest-700">Aucun creneau libre a cette date.</p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {rescheduleSlots.map((slot, idx) => (
                          <button key={idx} onClick={() => submitReschedule(a.id, slot.slot_start)}
                            className="rounded-lg border border-forest-100 bg-white py-2 text-sm font-medium text-forest-900 hover:border-primary-500 hover:bg-primary-50 transition">
                            {new Date(slot.slot_start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </button>
                        ))}
                      </div>
                    )
                  )}
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
                      {SELECTABLE_DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
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

      {tab === 'reviews' && (
        myDoctorId ? <DoctorReviewsList doctorId={myDoctorId} /> : <p className="text-forest-700">Chargement...</p>
      )}

      {tab === 'schedule' && <MySchedule />}

      {tab === 'messages' && (
        <div>
          <div className="mb-4">
            <StartConversation
              searchFn={async (query) => {
                const { data } = await api.get('/doctors/me/patients', { params: query ? { search: query } : {} })
                return data.map((p) => ({ patient_id: p.id, full_name: p.full_name }))
              }}
              onStart={(p) => { setSelectedPatientId(p.patient_id); setSelectedPatientName(p.full_name) }}
            />
          </div>
          {conversations.length === 0 && !selectedConversation ? (
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

      {tab === 'internal-messages' && <InternalMessaging />}
    </SidebarLayout>
  )
}
