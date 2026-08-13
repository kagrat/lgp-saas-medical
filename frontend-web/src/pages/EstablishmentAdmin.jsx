import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { SPECIALTIES, DAYS_OF_WEEK } from '../constants'
import StarRating from '../components/StarRating'
import { RESERVATION_STATUSES, RESERVATION_STATUS_LABELS, RESERVATION_STEPS } from '../components/OrderStatus'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '../components/DocumentType'
import { LAB_STATUSES, LAB_STATUS_LABELS, LAB_STEPS } from '../components/LabStatus'
import { AppointmentStatusBadge, APPOINTMENT_STATUS_LABELS } from '../components/AppointmentStatusUI'
import ChatWindow from '../components/ChatWindow'
import TeamMembers from '../components/TeamMembers'
import PatientDirectory from '../components/PatientDirectory'
import OpeningHoursManager from '../components/OpeningHoursManager'
import FilterTabs from '../components/FilterTabs'
import StatusStepper from '../components/StatusStepper'
import { LabStatsCards, RegisterTestByStaff } from '../components/LabStaffTools'

export default function EstablishmentAdmin() {
  const [establishment, setEstablishment] = useState(null)
  const [tab, setTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [appointmentFilter, setAppointmentFilter] = useState('all')
  const [stock, setStock] = useState([])
  const [orders, setOrders] = useState([])
  const [orderFilter, setOrderFilter] = useState('all')
  const [labTests, setLabTests] = useState([])
  const [labFilter, setLabFilter] = useState('all')
  const [conversations, setConversations] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [error, setError] = useState('')
  const [expandedDoctorId, setExpandedDoctorId] = useState(null)
  const [updatingOrderId, setUpdatingOrderId] = useState(null)
  const [orderUpdateForm, setOrderUpdateForm] = useState({})
  const [completingId, setCompletingId] = useState(null)
  const [arrivingId, setArrivingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [reschedulingId, setReschedulingId] = useState(null)
  const [rescheduleValue, setRescheduleValue] = useState('')
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null)
  const [docForm, setDocForm] = useState({ document_type: 'consultation_note', title: '', content: '' })
  const [savingDoc, setSavingDoc] = useState(false)
  const [docMessage, setDocMessage] = useState('')
  const [labUpdateForm, setLabUpdateForm] = useState({})
  const [updatingLabId, setUpdatingLabId] = useState(null)

  const [newDoctor, setNewDoctor] = useState({
    email: '', password: '', full_name: '', phone: '', specialty: SPECIALTIES[0], consultation_price: '',
  })
  const [newStock, setNewStock] = useState({ reference: '', medication_name: '', category: '', quantity: '', alert_threshold: 10, unit_price: '' })

  useEffect(() => {
    loadEstablishment()
  }, [])

  useEffect(() => {
    if (establishment) loadAll()
  }, [establishment])

  useEffect(() => {
    if (tab === 'messages') loadConversations()
  }, [tab])

  async function loadEstablishment() {
    try {
      const { data } = await api.get('/establishments/me')
      setEstablishment(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger les informations de l'etablissement."))
    }
  }

  async function loadConversations() {
    try {
      const { data } = await api.get('/messages/establishment/patients')
      setConversations(data)
      if (data.length > 0 && !selectedPatientId) {
        setSelectedPatientId(data[0].patient_id)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les conversations.'))
    }
  }

  async function loadAll() {
    try {
      const isLab = establishment.type === 'laboratoire'
      const calls = [api.get('/dashboard/establishment')]

      if (!isLab) {
        calls.push(api.get('/doctors/establishment'), api.get('/appointments/establishment'), api.get('/pharmacy/stock'), api.get('/pharmacy/reservations/establishment'))
      } else {
        calls.push(api.get('/lab/tests/establishment'))
      }

      const results = await Promise.all(calls)
      setStats(results[0].data)

      if (!isLab) {
        setDoctors(results[1].data)
        setAppointments(results[2].data)
        setStock(results[3].data)
        setOrders(results[4].data)
        const initialOrderForms = {}
        results[4].data.forEach((o) => {
          initialOrderForms[o.id] = { status: o.status, note: o.pharmacist_note || '', estimated_ready_at: '' }
        })
        setOrderUpdateForm(initialOrderForms)
      } else {
        setLabTests(results[1].data)
        const initialLabForms = {}
        results[1].data.forEach((t) => {
          initialLabForms[t.id] = { status: t.status, results_text: t.results_text || '', lab_technician_note: t.lab_technician_note || '' }
        })
        setLabUpdateForm(initialLabForms)
      }
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger le tableau de bord. Verifie que tu es bien connecte en tant qu'admin etablissement."))
    }
  }

  async function handleAddDoctor(e) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/doctors', { ...newDoctor, consultation_price: Number(newDoctor.consultation_price) })
      setNewDoctor({ email: '', password: '', full_name: '', phone: '', specialty: SPECIALTIES[0], consultation_price: '' })
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce medecin."))
    }
  }

  async function handleAddStock(e) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/pharmacy/stock', {
        ...newStock,
        quantity: Number(newStock.quantity),
        alert_threshold: Number(newStock.alert_threshold),
        unit_price: Number(newStock.unit_price),
      })
      setNewStock({ reference: '', medication_name: '', category: '', quantity: '', alert_threshold: 10, unit_price: '' })
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce medicament."))
    }
  }

  function updateOrderForm(reservationId, field, value) {
    setOrderUpdateForm((forms) => ({ ...forms, [reservationId]: { ...forms[reservationId], [field]: value } }))
  }

  async function submitOrderUpdate(reservationId) {
    setUpdatingOrderId(reservationId)
    setError('')
    try {
      const form = orderUpdateForm[reservationId]
      await api.patch(`/pharmacy/reservations/${reservationId}/status`, {
        status: form.status,
        note: form.note || null,
        estimated_ready_at: form.estimated_ready_at ? new Date(form.estimated_ready_at).toISOString() : null,
      })
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de mettre a jour cette commande."))
    } finally {
      setUpdatingOrderId(null)
    }
  }

  async function markCompleted(appointmentId) {
    setCompletingId(appointmentId)
    setError('')
    try {
      await api.post(`/appointments/${appointmentId}/complete`)
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de marquer ce rendez-vous comme termine."))
    } finally {
      setCompletingId(null)
    }
  }

  async function markArrived(appointmentId) {
    setArrivingId(appointmentId)
    setError('')
    try {
      await api.post(`/appointments/${appointmentId}/arrive`)
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de marquer ce rendez-vous comme arrive."))
    } finally {
      setArrivingId(null)
    }
  }

  async function cancelAppointment(appointmentId) {
    setCancellingId(appointmentId)
    setError('')
    try {
      await api.post(`/appointments/${appointmentId}/cancel`)
      await loadAll()
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
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de reporter ce rendez-vous.'))
    }
  }

  async function toggleAppointmentExpand(appointmentId) {
    setExpandedAppointmentId(expandedAppointmentId === appointmentId ? null : appointmentId)
    setDocMessage('')
    setDocForm({ document_type: 'consultation_note', title: '', content: '' })
  }

  async function submitDocument(appointmentId) {
    setSavingDoc(true)
    setDocMessage('')
    setError('')
    try {
      await api.post('/health-records', {
        appointment_id: appointmentId,
        document_type: docForm.document_type,
        title: docForm.title,
        content: docForm.content,
      })
      setDocMessage('Ajoute au dossier de sante du patient.')
      setDocForm({ document_type: 'consultation_note', title: '', content: '' })
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce document au dossier."))
    } finally {
      setSavingDoc(false)
    }
  }

  function updateLabForm(testId, field, value) {
    setLabUpdateForm((forms) => ({ ...forms, [testId]: { ...forms[testId], [field]: value } }))
  }

  async function submitLabUpdate(testId) {
    setUpdatingLabId(testId)
    setError('')
    try {
      const form = labUpdateForm[testId]
      await api.patch(`/lab/tests/${testId}/status`, {
        status: form.status,
        results_text: form.results_text || null,
        lab_technician_note: form.lab_technician_note || null,
      })
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de mettre a jour cette analyse."))
    } finally {
      setUpdatingLabId(null)
    }
  }

  if (!establishment) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-14">
        {error ? <p className="text-clay-600">{error}</p> : <p className="text-forest-700">Chargement...</p>}
      </div>
    )
  }

  const isLab = establishment.type === 'laboratoire'

  const baseTabs = isLab
    ? [
        { id: 'stats', label: 'Statistiques' },
        { id: 'analyses', label: 'Analyses' },
      ]
    : [
        { id: 'stats', label: 'Statistiques' },
        { id: 'doctors', label: 'Medecins' },
        { id: 'appointments', label: 'Rendez-vous' },
        { id: 'pharmacy', label: 'Pharmacie' },
        { id: 'orders', label: 'Commandes' },
      ]
  const tabs = [
    ...baseTabs,
    { id: 'patients', label: 'Patients' },
    { id: 'messages', label: 'Messages' },
    { id: 'team', label: 'Equipe' },
    { id: 'hours', label: 'Horaires' },
  ]

  const selectedConversation = conversations.find((c) => c.patient_id === selectedPatientId)

  const appointmentFilterOptions = [
    { value: 'all', label: 'Tous' },
    { value: 'confirmed', label: 'Confirmes' },
    { value: 'arrived', label: 'Arrives' },
    { value: 'completed', label: 'Termines' },
    { value: 'cancelled', label: 'Annules' },
  ]
  const filteredAppointments = appointmentFilter === 'all' ? appointments : appointments.filter((a) => a.status === appointmentFilter)

  const orderFilterOptions = [{ value: 'all', label: 'Tous' }, ...RESERVATION_STATUSES.map((s) => ({ value: s, label: RESERVATION_STATUS_LABELS[s] }))]
  const filteredOrders = orderFilter === 'all' ? orders : orders.filter((o) => o.status === orderFilter)

  const labFilterOptions = [{ value: 'all', label: 'Tous' }, ...LAB_STATUSES.map((s) => ({ value: s, label: LAB_STATUS_LABELS[s] }))]
  const filteredLabTests = labFilter === 'all' ? labTests : labTests.filter((t) => t.status === labFilter)

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-2">{establishment.name}</h1>
      <p className="text-forest-700 mb-8">
        {isLab ? 'Gestion des demandes d\'analyses.' : 'Gestion des medecins, rendez-vous et pharmacie de ton etablissement.'}
      </p>

      <div className="flex gap-2 mb-8 border-b border-forest-100 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 font-medium border-b-2 -mb-px transition ${tab === t.id ? 'border-amber-500 text-forest-900' : 'border-transparent text-forest-700 hover:text-forest-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {tab === 'stats' && stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="RDV totaux" value={stats.total_appointments} />
          <StatCard label="RDV ce mois" value={stats.appointments_this_month} trendPct={stats.appointments_trend_pct} />
          <StatCard label="Medecins actifs" value={stats.total_doctors} />
          <StatCard label="Alertes stock" value={stats.low_stock_items} highlight={stats.low_stock_items > 0} />
        </div>
      )}

      {tab === 'doctors' && !isLab && (
        <div>
          <form onSubmit={handleAddDoctor} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-6">
            <input required placeholder="Nom complet" value={newDoctor.full_name}
              onChange={(e) => setNewDoctor({ ...newDoctor, full_name: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required type="email" placeholder="Email" value={newDoctor.email}
              onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input placeholder="Telephone (ex: +229 ...)" value={newDoctor.phone}
              onChange={(e) => setNewDoctor({ ...newDoctor, phone: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required type="password" placeholder="Mot de passe temporaire" value={newDoctor.password}
              onChange={(e) => setNewDoctor({ ...newDoctor, password: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <select required value={newDoctor.specialty} onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2 bg-white">
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input required type="number" placeholder="Prix consultation (FCFA)" value={newDoctor.consultation_price}
              onChange={(e) => setNewDoctor({ ...newDoctor, consultation_price: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <button type="submit" className="sm:col-span-2 rounded-full bg-forest-700 text-white py-2.5 font-medium hover:bg-forest-900 transition">
              Ajouter ce medecin
            </button>
          </form>

          <div className="space-y-2">
            {doctors.map((d) => (
              <div key={d.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-forest-900 font-medium">{d.full_name}</p>
                    <p className="text-sm text-forest-700">
                      {d.specialty} - {d.consultation_price.toLocaleString('fr-FR')} FCFA
                      {d.phone && ` - ${d.phone}`}
                    </p>
                    <StarRating rating={d.average_rating} reviewCount={d.review_count} />
                  </div>
                  <button
                    onClick={() => setExpandedDoctorId(expandedDoctorId === d.id ? null : d.id)}
                    className="text-sm rounded-full border border-forest-300 px-4 py-1.5 hover:bg-forest-50 transition"
                  >
                    {expandedDoctorId === d.id ? 'Fermer' : 'Gerer les disponibilites'}
                  </button>
                </div>
                {expandedDoctorId === d.id && <DoctorAvailabilities doctorId={d.id} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'appointments' && !isLab && (
        <div>
          <FilterTabs options={appointmentFilterOptions} active={appointmentFilter} onChange={setAppointmentFilter} />
          <div className="space-y-2">
            {filteredAppointments.length === 0 && <p className="text-forest-700">Aucun rendez-vous dans cette categorie.</p>}
            {filteredAppointments.map((a) => (
              <div key={a.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <p className="text-forest-900">
                    {new Date(a.scheduled_at).toLocaleString('fr-FR')}
                  </p>
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
                          className="text-sm rounded-full bg-forest-700 text-white px-4 py-1.5 hover:bg-forest-900 transition disabled:opacity-50"
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
                      className="rounded-full bg-amber-500 text-forest-900 px-4 py-1.5 text-sm font-semibold hover:bg-amber-400 transition">
                      Confirmer le report
                    </button>
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
                    <textarea
                      placeholder="Contenu (traitement prescrit, resultat, observations...)"
                      value={docForm.content}
                      onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                      rows={3}
                      className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3"
                    />
                    <button
                      onClick={() => submitDocument(a.id)}
                      disabled={savingDoc || !docForm.title || !docForm.content}
                      className="rounded-full bg-amber-500 text-forest-900 px-5 py-1.5 text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50"
                    >
                      {savingDoc ? 'Ajout...' : 'Ajouter au dossier du patient'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pharmacy' && !isLab && (
        <div>
          <form onSubmit={handleAddStock} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-6">
            <input required placeholder="Reference (ex: MED-00123)" value={newStock.reference}
              onChange={(e) => setNewStock({ ...newStock, reference: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required placeholder="Nom du medicament" value={newStock.medication_name}
              onChange={(e) => setNewStock({ ...newStock, medication_name: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input placeholder="Categorie" value={newStock.category}
              onChange={(e) => setNewStock({ ...newStock, category: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required type="number" placeholder="Quantite" value={newStock.quantity}
              onChange={(e) => setNewStock({ ...newStock, quantity: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required type="number" placeholder="Seuil d'alerte" value={newStock.alert_threshold}
              onChange={(e) => setNewStock({ ...newStock, alert_threshold: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <input required type="number" placeholder="Prix unitaire (FCFA)" value={newStock.unit_price}
              onChange={(e) => setNewStock({ ...newStock, unit_price: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2" />
            <button type="submit" className="rounded-full bg-forest-700 text-white py-2.5 font-medium hover:bg-forest-900 transition">
              Ajouter au stock
            </button>
          </form>

          <div className="space-y-2">
            {stock.map((s) => (
              <div key={s.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
                <div>
                  <p className="text-forest-900 font-medium">{s.medication_name} <span className="text-xs text-forest-700 font-normal">({s.reference})</span></p>
                  <p className="text-sm text-forest-700">{s.quantity} en stock - {s.unit_price.toLocaleString('fr-FR')} FCFA</p>
                </div>
                {s.is_low_stock && <span className="text-xs px-3 py-1 rounded-full bg-clay-500/10 text-clay-600 font-medium">Stock bas</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'orders' && !isLab && (
        <div>
          <FilterTabs options={orderFilterOptions} active={orderFilter} onChange={setOrderFilter} />
          <div className="space-y-3">
            {filteredOrders.length === 0 && <p className="text-forest-700">Aucune commande dans cette categorie.</p>}
            {filteredOrders.map((o) => (
              <div key={o.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="mb-3">
                  <p className="text-forest-900 font-medium">{o.medication_name} <span className="text-xs text-forest-700 font-normal">({o.medication_reference})</span></p>
                  <p className="text-sm text-forest-700 mb-3">
                    Quantite: {o.quantity} - {o.delivery_mode === 'delivery' ? 'Livraison' : 'Retrait sur place'}
                  </p>
                  <StatusStepper steps={RESERVATION_STEPS} currentValue={o.status} labels={RESERVATION_STATUS_LABELS} />
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="block text-xs text-forest-700 mb-1">Nouveau statut</label>
                    <select
                      value={orderUpdateForm[o.id]?.status || o.status}
                      onChange={(e) => updateOrderForm(o.id, 'status', e.target.value)}
                      className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm bg-white"
                    >
                      {RESERVATION_STATUSES.map((s) => (
                        <option key={s} value={s}>{RESERVATION_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-forest-700 mb-1">Pret estime (optionnel)</label>
                    <input type="datetime-local"
                      value={orderUpdateForm[o.id]?.estimated_ready_at || ''}
                      onChange={(e) => updateOrderForm(o.id, 'estimated_ready_at', e.target.value)}
                      className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-forest-700 mb-1">Note pour le patient (optionnel)</label>
                    <input type="text"
                      value={orderUpdateForm[o.id]?.note || ''}
                      onChange={(e) => updateOrderForm(o.id, 'note', e.target.value)}
                      placeholder="Ex: en rupture temporaire, disponible demain"
                      className="w-full rounded-lg border border-forest-100 px-3 py-1.5 text-sm" />
                  </div>
                  <button
                    onClick={() => submitOrderUpdate(o.id)}
                    disabled={updatingOrderId === o.id}
                    className="rounded-full bg-forest-700 text-white px-5 py-1.5 text-sm font-medium hover:bg-forest-900 transition disabled:opacity-50"
                  >
                    {updatingOrderId === o.id ? 'Mise a jour...' : 'Mettre a jour'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'analyses' && isLab && (
        <div>
          <LabStatsCards />
          <RegisterTestByStaff onRegistered={loadAll} />
          <FilterTabs options={labFilterOptions} active={labFilter} onChange={setLabFilter} />
          <div className="space-y-3">
            {filteredLabTests.length === 0 && <p className="text-forest-700">Aucune analyse dans cette categorie.</p>}
            {filteredLabTests.map((t) => (
              <div key={t.id} className="rounded-xl border border-forest-100 bg-white p-4">
                <div className="mb-3">
                  <p className="text-forest-900 font-medium">{t.test_name}</p>
                  {t.sample_type && <p className="text-sm text-forest-700">Prelevement: {t.sample_type}</p>}
                  {t.sample_collected_at && (
                    <p className="text-xs text-forest-700 mb-3">Preleve le {new Date(t.sample_collected_at).toLocaleString('fr-FR')}</p>
                  )}
                  <StatusStepper steps={LAB_STEPS} currentValue={t.status} labels={LAB_STATUS_LABELS} />
                </div>
                <div className="grid sm:grid-cols-2 gap-2 mb-2 mt-3">
                  <select
                    value={labUpdateForm[t.id]?.status || t.status}
                    onChange={(e) => updateLabForm(t.id, 'status', e.target.value)}
                    className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm bg-white"
                  >
                    {LAB_STATUSES.map((s) => <option key={s} value={s}>{LAB_STATUS_LABELS[s]}</option>)}
                  </select>
                  <input
                    placeholder="Note (optionnel)"
                    value={labUpdateForm[t.id]?.lab_technician_note || ''}
                    onChange={(e) => updateLabForm(t.id, 'lab_technician_note', e.target.value)}
                    className="rounded-lg border border-forest-100 px-3 py-1.5 text-sm"
                  />
                </div>
                <textarea
                  placeholder="Resultats (a remplir quand l'analyse est validee)"
                  value={labUpdateForm[t.id]?.results_text || ''}
                  onChange={(e) => updateLabForm(t.id, 'results_text', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2"
                />
                <button
                  onClick={() => submitLabUpdate(t.id)}
                  disabled={updatingLabId === t.id}
                  className="rounded-full bg-forest-700 text-white px-5 py-1.5 text-sm font-medium hover:bg-forest-900 transition disabled:opacity-50"
                >
                  {updatingLabId === t.id ? 'Mise a jour...' : 'Mettre a jour'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'patients' && <PatientDirectory />}

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

      {tab === 'team' && <TeamMembers />}

      {tab === 'hours' && <OpeningHoursManager />}
    </div>
  )
}

function DoctorAvailabilities({ doctorId }) {
  const [availabilities, setAvailabilities] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ day_of_week: 0, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 30 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [doctorId])

  async function load() {
    try {
      const { data } = await api.get(`/doctors/${doctorId}/availabilities`)
      setAvailabilities(data)
    } catch (err) {
      setError('Impossible de charger les disponibilites.')
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post(`/doctors/${doctorId}/availabilities`, {
        day_of_week: Number(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        slot_duration_minutes: Number(form.slot_duration_minutes),
      })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce creneau. Verifie que l'heure de fin est bien apres l'heure de debut."))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(availabilityId) {
    try {
      await api.delete(`/doctors/${doctorId}/availabilities/${availabilityId}`)
      await load()
    } catch (err) {
      setError('Suppression impossible.')
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-forest-100">
      <p className="text-sm font-medium text-forest-900 mb-3">
        Disponibilites hebdomadaires (se repetent chaque semaine)
      </p>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end mb-4">
        <div>
          <label className="block text-xs text-forest-700 mb-1">Jour</label>
          <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
            className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm bg-white">
            {DAYS_OF_WEEK.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-forest-700 mb-1">De</label>
          <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-forest-700 mb-1">A</label>
          <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-forest-700 mb-1">Duree/RDV (min)</label>
          <input type="number" min="5" step="5" value={form.slot_duration_minutes}
            onChange={(e) => setForm({ ...form, slot_duration_minutes: e.target.value })}
            className="w-24 rounded-lg border border-forest-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={saving}
          className="rounded-full bg-amber-500 text-forest-900 px-4 py-1.5 text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50">
          {saving ? 'Ajout...' : 'Ajouter ce creneau'}
        </button>
      </form>

      {error && <p className="text-clay-600 text-sm mb-3">{error}</p>}

      {availabilities.length === 0 ? (
        <p className="text-sm text-forest-700">Aucune disponibilite enregistree pour ce medecin.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {availabilities.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-full bg-forest-50 px-3 py-1.5 text-sm text-forest-900">
              <span>
                {DAYS_OF_WEEK.find((d) => d.value === a.day_of_week)?.label} {a.start_time.slice(0, 5)}-{a.end_time.slice(0, 5)}
              </span>
              <button onClick={() => handleDelete(a.id)} className="text-clay-600 hover:text-clay-500 font-bold" aria-label="Supprimer ce creneau">
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, highlight, trendPct }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? 'border-clay-500 bg-clay-500/5' : 'border-forest-100 bg-white'}`}>
      <p className="text-sm text-forest-700 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`font-display text-3xl font-semibold ${highlight ? 'text-clay-600' : 'text-forest-900'}`}>{value}</p>
        {trendPct !== null && trendPct !== undefined && (
          <span className={`text-xs font-medium ${trendPct >= 0 ? 'text-forest-500' : 'text-clay-600'}`}>
            {trendPct >= 0 ? '+' : ''}{trendPct}%
          </span>
        )}
      </div>
    </div>
  )
}
