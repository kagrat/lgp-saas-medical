import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (hospitalisation, demande confirmee par M. Faustin): le medecin
 * decide l'admission, fait sa tournee (notes quotidiennes), transfere ou
 * sort un patient. Reutilise /patients/establishment (deja restreint
 * hopital/clinique) pour rechercher le patient a admettre - pas besoin
 * d'un nouvel endpoint de recherche.
 */
export default function Hospitalizations() {
  const [admissions, setAdmissions] = useState([])
  const [departments, setDepartments] = useState([])
  const [rooms, setRooms] = useState([])
  const [error, setError] = useState('')

  const [showAdmitForm, setShowAdmitForm] = useState(false)
  const [patientQuery, setPatientQuery] = useState('')
  const [patientResults, setPatientResults] = useState([])
  const [admitForm, setAdmitForm] = useState({ patient_id: '', patient_name: '', department_id: '', room_id: '', diagnosis: '', expected_discharge_date: '' })
  const [admitting, setAdmitting] = useState(false)

  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [noteForm, setNoteForm] = useState({ title: '', content: '' })
  const [savingNote, setSavingNote] = useState(false)

  const [transferOpen, setTransferOpen] = useState(false)
  const [transferForm, setTransferForm] = useState({ to_department_id: '', to_room_id: '', note: '' })
  const [transferring, setTransferring] = useState(false)

  const [dischargeOpen, setDischargeOpen] = useState(false)
  const [dischargeSummary, setDischargeSummary] = useState('')
  const [discharging, setDischarging] = useState(false)

  useEffect(() => {
    load()
    loadReferenceData()
  }, [])

  async function load() {
    setError('')
    try {
      const { data } = await api.get('/admissions/establishment', { params: { admission_status: 'active' } })
      setAdmissions(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les hospitalisations.'))
    }
  }

  async function loadReferenceData() {
    try {
      const [deptRes, roomRes] = await Promise.all([
        api.get('/establishments/departments'),
        api.get('/services/rooms/mine'),
      ])
      setDepartments(deptRes.data)
      setRooms(roomRes.data)
    } catch {
      // secondaire, pas bloquant
    }
  }

  async function searchPatients(e) {
    e.preventDefault()
    try {
      const { data } = await api.get('/patients/establishment', { params: { search: patientQuery } })
      setPatientResults(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Recherche impossible.'))
    }
  }

  function pickPatient(p) {
    setAdmitForm({ ...admitForm, patient_id: p.id, patient_name: p.full_name })
    setPatientResults([])
    setPatientQuery(p.full_name)
  }

  async function submitAdmit(e) {
    e.preventDefault()
    if (!admitForm.patient_id) {
      setError('Choisis un patient dans les resultats de recherche.')
      return
    }
    setAdmitting(true)
    setError('')
    try {
      await api.post('/admissions', {
        patient_id: admitForm.patient_id,
        department_id: admitForm.department_id || null,
        room_id: admitForm.room_id || null,
        diagnosis: admitForm.diagnosis || null,
        expected_discharge_date: admitForm.expected_discharge_date || null,
      })
      setShowAdmitForm(false)
      setAdmitForm({ patient_id: '', patient_name: '', department_id: '', room_id: '', diagnosis: '', expected_discharge_date: '' })
      setPatientQuery('')
      await load()
      await loadReferenceData()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'admettre ce patient."))
    } finally {
      setAdmitting(false)
    }
  }

  async function openAdmission(id) {
    setSelectedId(id)
    setDetail(null)
    setLoadingDetail(true)
    setTransferOpen(false)
    setDischargeOpen(false)
    try {
      const { data } = await api.get(`/admissions/${id}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger cette hospitalisation."))
    } finally {
      setLoadingDetail(false)
    }
  }

  async function submitNote() {
    setSavingNote(true)
    setError('')
    try {
      await api.post(`/admissions/${selectedId}/progress-note`, { title: noteForm.title, content: noteForm.content })
      setNoteForm({ title: '', content: '' })
      const { data } = await api.get(`/admissions/${selectedId}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter cette note."))
    } finally {
      setSavingNote(false)
    }
  }

  async function submitTransfer() {
    setTransferring(true)
    setError('')
    try {
      await api.post(`/admissions/${selectedId}/transfer`, {
        to_department_id: transferForm.to_department_id || null,
        to_room_id: transferForm.to_room_id || null,
        note: transferForm.note || null,
      })
      setTransferOpen(false)
      setTransferForm({ to_department_id: '', to_room_id: '', note: '' })
      const { data } = await api.get(`/admissions/${selectedId}`)
      setDetail(data)
      await loadReferenceData()
    } catch (err) {
      setError(getErrorMessage(err, 'Transfert impossible.'))
    } finally {
      setTransferring(false)
    }
  }

  async function submitDischarge() {
    setDischarging(true)
    setError('')
    try {
      await api.post(`/admissions/${selectedId}/discharge`, { discharge_summary: dischargeSummary })
      setSelectedId(null)
      setDetail(null)
      await load()
      await loadReferenceData()
    } catch (err) {
      setError(getErrorMessage(err, 'Sortie impossible.'))
    } finally {
      setDischarging(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-forest-700 text-sm">Patients actuellement hospitalises.</p>
        <button onClick={() => setShowAdmitForm((v) => !v)} className="rounded-full bg-primary-700 text-white px-5 py-2 text-sm font-medium hover:bg-primary-900 transition">
          {showAdmitForm ? 'Annuler' : 'Admettre un patient'}
        </button>
      </div>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {showAdmitForm && (
        <form onSubmit={submitAdmit} className="bg-white border border-forest-100 rounded-xl p-5 mb-6">
          <p className="text-sm font-medium text-forest-900 mb-2">Rechercher le patient</p>
          <form onSubmit={searchPatients} className="flex gap-2 mb-3">
            <input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Nom du patient..."
              className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            <button type="submit" className="rounded-full bg-primary-700 text-white px-4 py-2 text-sm font-medium hover:bg-primary-900 transition">Chercher</button>
          </form>
          {patientResults.length > 0 && (
            <div className="space-y-1 mb-3">
              {patientResults.map((p) => (
                <button type="button" key={p.id} onClick={() => pickPatient(p)}
                  className="block w-full text-left text-sm rounded-lg border border-forest-100 p-2 hover:border-forest-300 transition">
                  {p.full_name} - dossier {p.dossier_number}
                </button>
              ))}
            </div>
          )}
          {admitForm.patient_id && <p className="text-sm text-forest-900 font-medium mb-3">Patient choisi: {admitForm.patient_name}</p>}

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <select value={admitForm.department_id} onChange={(e) => setAdmitForm({ ...admitForm, department_id: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
              <option value="">Departement (optionnel)</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={admitForm.room_id} onChange={(e) => setAdmitForm({ ...admitForm, room_id: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
              <option value="">Chambre (optionnel)</option>
              {rooms.filter((r) => !r.is_occupied).map((r) => <option key={r.id} value={r.id}>{r.name}{r.department_name ? ` - ${r.department_name}` : ''}</option>)}
            </select>
          </div>
          <textarea placeholder="Diagnostic (optionnel)" value={admitForm.diagnosis}
            onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })}
            rows={2} className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3" />
          <div className="mb-3">
            <label className="block text-xs text-forest-700 mb-1">Date de sortie prevue (optionnel)</label>
            <input type="date" value={admitForm.expected_discharge_date}
              onChange={(e) => setAdmitForm({ ...admitForm, expected_discharge_date: e.target.value })}
              className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={admitting}
            className="rounded-full bg-amber-500 text-forest-900 px-5 py-2 text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50">
            {admitting ? 'Admission...' : 'Confirmer l\'admission'}
          </button>
        </form>
      )}

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
                <button onClick={() => setSelectedId(null)} className="text-sm text-forest-700 hover:text-forest-900 hover:underline">Fermer</button>
              </div>

              <div className="flex gap-2 mb-4">
                <button onClick={() => { setTransferOpen((v) => !v); setDischargeOpen(false) }} className="text-sm text-amber-600 font-medium hover:underline">
                  Transferer
                </button>
                <button onClick={() => { setDischargeOpen((v) => !v); setTransferOpen(false) }} className="text-sm text-amber-600 font-medium hover:underline">
                  Faire sortir le patient
                </button>
              </div>

              {transferOpen && (
                <div className="bg-white rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-forest-900 mb-2">Transferer vers</p>
                  <div className="grid sm:grid-cols-2 gap-2 mb-2">
                    <select value={transferForm.to_department_id} onChange={(e) => setTransferForm({ ...transferForm, to_department_id: e.target.value })}
                      className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
                      <option value="">Departement</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <select value={transferForm.to_room_id} onChange={(e) => setTransferForm({ ...transferForm, to_room_id: e.target.value })}
                      className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
                      <option value="">Chambre</option>
                      {rooms.filter((r) => !r.is_occupied).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <input placeholder="Motif (optionnel)" value={transferForm.note}
                    onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                    className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2" />
                  <button onClick={submitTransfer} disabled={transferring}
                    className="rounded-full bg-primary-700 text-white px-5 py-1.5 text-sm font-medium hover:bg-primary-900 transition disabled:opacity-50">
                    {transferring ? 'Transfert...' : 'Confirmer le transfert'}
                  </button>
                </div>
              )}

              {dischargeOpen && (
                <div className="bg-white rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-forest-900 mb-2">Resume de sortie</p>
                  <textarea required value={dischargeSummary} onChange={(e) => setDischargeSummary(e.target.value)}
                    rows={3} placeholder="Motif de sortie, recommandations..."
                    className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2" />
                  <button onClick={submitDischarge} disabled={discharging || !dischargeSummary}
                    className="rounded-full bg-clay-600 text-white px-5 py-1.5 text-sm font-medium hover:bg-clay-700 transition disabled:opacity-50">
                    {discharging ? 'Sortie...' : 'Confirmer la sortie'}
                  </button>
                </div>
              )}

              <div className="bg-white rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-forest-900 mb-2">Ajouter une note de tournee</p>
                <input placeholder="Titre" value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2" />
                <textarea placeholder="Contenu" value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  rows={2} className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2" />
                <button onClick={submitNote} disabled={savingNote || !noteForm.title || !noteForm.content}
                  className="rounded-full bg-amber-500 text-forest-900 px-5 py-1.5 text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50">
                  {savingNote ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>

              <p className="text-sm font-medium text-forest-900 mb-2">Constantes vitales (infirmier)</p>
              {detail.vital_signs.length === 0 && <p className="text-sm text-forest-700 mb-3">Aucune constante relevee.</p>}
              <div className="space-y-1 mb-4">
                {detail.vital_signs.slice(0, 5).map((v) => (
                  <p key={v.id} className="text-sm text-forest-700">
                    {new Date(v.recorded_at).toLocaleString('fr-FR')} - {v.recorded_by_name}
                    {v.temperature_celsius !== null && ` - ${v.temperature_celsius}°C`}
                    {v.blood_pressure && ` - ${v.blood_pressure}`}
                  </p>
                ))}
              </div>

              <p className="text-sm font-medium text-forest-900 mb-2">Notes et documents</p>
              {detail.documents.length === 0 && <p className="text-sm text-forest-700">Aucun document.</p>}
              <div className="space-y-2">
                {detail.documents.map((d) => (
                  <div key={d.id} className="bg-white rounded-lg p-3 text-sm">
                    <p className="text-forest-900 font-medium">{d.title}</p>
                    <p className="text-forest-700 text-xs mb-1">{d.doctor_name} - {new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
                    <p className="text-forest-700 whitespace-pre-wrap">{d.content}</p>
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
          <button key={a.id} onClick={() => openAdmission(a.id)}
            className="w-full text-left rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center hover:border-forest-300 transition">
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
  )
}
