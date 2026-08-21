import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { DocumentTypeBadge, DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from './DocumentType'

/**
 * NOUVEAU (demande M. Faustin): "Mes patients" cote medecin - distinct du
 * repertoire etablissement (PatientDirectory.jsx, reserve admin/secretariat,
 * qui montre TOUS les patients de l'etablissement). Ici: uniquement les
 * patients que CE medecin a personnellement consultes (rendez-vous
 * termine), avec la possibilite de completer leur dossier en cliquant sur
 * leur nom, et d'envoyer ce dossier a un confrere.
 */
export default function MyPatients() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [docForm, setDocForm] = useState({ appointment_id: '', document_type: 'consultation_note', title: '', content: '' })
  const [savingDoc, setSavingDoc] = useState(false)
  const [docMessage, setDocMessage] = useState('')

  const [shareOpen, setShareOpen] = useState(false)
  const [doctorQuery, setDoctorQuery] = useState('')
  const [doctorResults, setDoctorResults] = useState([])
  const [shareNote, setShareNote] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareMessage, setShareMessage] = useState('')

  const [sharedWithMe, setSharedWithMe] = useState([])

  useEffect(() => {
    load()
    loadSharedWithMe()
  }, [])

  async function load(query) {
    setError('')
    try {
      const { data } = await api.get('/doctors/me/patients', { params: query ? { search: query } : {} })
      setPatients(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger tes patients.'))
    }
  }

  async function loadSharedWithMe() {
    try {
      const { data } = await api.get('/doctors/me/shared-with-me')
      setSharedWithMe(data)
    } catch {
      // silencieux: section secondaire, pas bloquant si indisponible
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    load(search)
  }

  async function openPatient(patientId) {
    setSelectedId(patientId)
    setDetail(null)
    setLoadingDetail(true)
    setError('')
    setDocMessage('')
    setShareOpen(false)
    setShareMessage('')
    try {
      const { data } = await api.get(`/doctors/me/patients/${patientId}`)
      setDetail(data)
      setDocForm({
        appointment_id: data.appointments[0]?.id || '',
        document_type: 'consultation_note', title: '', content: '',
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger la fiche de ce patient.'))
    } finally {
      setLoadingDetail(false)
    }
  }

  function closePatient() {
    setSelectedId(null)
    setDetail(null)
  }

  async function submitDocument() {
    setSavingDoc(true)
    setDocMessage('')
    setError('')
    try {
      await api.post('/health-records', {
        appointment_id: docForm.appointment_id,
        document_type: docForm.document_type,
        title: docForm.title,
        content: docForm.content,
      })
      setDocMessage('Ajoute au dossier du patient.')
      setDocForm({ ...docForm, title: '', content: '' })
      const { data } = await api.get(`/doctors/me/patients/${selectedId}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce document au dossier."))
    } finally {
      setSavingDoc(false)
    }
  }

  async function searchDoctors(e) {
    e.preventDefault()
    try {
      const { data } = await api.get('/doctors/search', { params: { name: doctorQuery } })
      setDoctorResults(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Recherche de medecin impossible.'))
    }
  }

  async function sendShare(toDoctorId) {
    setSharing(true)
    setShareMessage('')
    setError('')
    try {
      await api.post(`/doctors/me/patients/${selectedId}/share`, { to_doctor_id: toDoctorId, note: shareNote || null })
      setShareMessage('Dossier envoye.')
      setShareOpen(false)
      setDoctorQuery('')
      setDoctorResults([])
      setShareNote('')
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'envoyer ce dossier."))
    } finally {
      setSharing(false)
    }
  }

  return (
    <div>
      {sharedWithMe.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-forest-900 mb-2">Dossiers partages par des confreres</p>
          <div className="space-y-1">
            {sharedWithMe.map((s) => (
              <button
                key={s.id}
                onClick={() => openPatient(s.patient_id)}
                className="block text-sm text-forest-700 hover:text-forest-900 hover:underline"
              >
                {s.patient_name} - envoye par {s.from_doctor_name}
                {s.note ? ` (${s.note})` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un de tes patients par nom..."
          className="flex-1 rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
        />
        <button type="submit" className="rounded-full bg-forest-700 text-white px-6 py-2.5 font-medium hover:bg-forest-900 transition">
          Rechercher
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {selectedId && (
        <div className="rounded-xl border border-forest-300 bg-forest-50 p-5 mb-4">
          {loadingDetail && <p className="text-sm text-forest-700">Chargement...</p>}
          {detail && (
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-display text-lg text-forest-900 font-semibold">{detail.full_name}</p>
                  <p className="text-sm text-forest-700">Dossier {detail.dossier_number}</p>
                  {detail.viewed_via_share_from && (
                    <p className="text-xs text-amber-600 font-medium mt-1">
                      Dossier consulte en lecture seule - partage par {detail.viewed_via_share_from}
                    </p>
                  )}
                </div>
                <button onClick={closePatient} className="text-sm text-forest-700 hover:text-forest-900 hover:underline">
                  Fermer
                </button>
              </div>

              <p className="text-sm font-medium text-forest-900 mb-2">Historique des consultations</p>
              {detail.appointments.length === 0 && <p className="text-sm text-forest-700 mb-3">Aucun rendez-vous.</p>}
              <div className="space-y-1 mb-4">
                {detail.appointments.map((a) => (
                  <p key={a.id} className="text-sm text-forest-700">{new Date(a.scheduled_at).toLocaleString('fr-FR')}</p>
                ))}
              </div>

              <p className="text-sm font-medium text-forest-900 mb-2">Documents du dossier</p>
              {detail.documents.length === 0 && <p className="text-sm text-forest-700 mb-3">Aucun document.</p>}
              <div className="space-y-2 mb-4">
                {detail.documents.map((d) => (
                  <div key={d.id} className="bg-white rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm text-forest-900 font-medium">{d.title}</p>
                      <DocumentTypeBadge type={d.document_type} />
                    </div>
                    <p className="text-xs text-forest-700 mb-1">{d.doctor_name} - {new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
                    <p className="text-sm text-forest-700 whitespace-pre-wrap">{d.content}</p>
                  </div>
                ))}
              </div>

              {detail.can_add_document && (
                <div className="bg-white rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-forest-900 mb-2">Ajouter au dossier</p>
                  {docMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-3 text-sm">{docMessage}</p>}
                  <div className="grid sm:grid-cols-2 gap-3 mb-3">
                    <select
                      value={docForm.appointment_id}
                      onChange={(e) => setDocForm({ ...docForm, appointment_id: e.target.value })}
                      className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white"
                    >
                      {detail.appointments.map((a) => (
                        <option key={a.id} value={a.id}>
                          Consultation du {new Date(a.scheduled_at).toLocaleDateString('fr-FR')}
                        </option>
                      ))}
                    </select>
                    <select
                      value={docForm.document_type}
                      onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })}
                      className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white"
                    >
                      {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <input
                    placeholder="Titre (ex: Ordonnance du 21 mai)"
                    value={docForm.title}
                    onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                    className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3"
                  />
                  <textarea
                    placeholder="Contenu (traitement prescrit, resultat, observations...)"
                    value={docForm.content}
                    onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3"
                  />
                  <button
                    onClick={submitDocument}
                    disabled={savingDoc || !docForm.appointment_id || !docForm.title || !docForm.content}
                    className="rounded-full bg-amber-500 text-forest-900 px-5 py-1.5 text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50"
                  >
                    {savingDoc ? 'Ajout...' : 'Ajouter au dossier'}
                  </button>
                </div>
              )}

              {detail.can_add_document && (
                <div className="bg-white rounded-lg p-4">
                  {shareMessage && <p className="text-forest-900 text-sm mb-2">{shareMessage}</p>}
                  {!shareOpen ? (
                    <button onClick={() => setShareOpen(true)} className="text-sm text-amber-600 font-medium hover:underline">
                      Envoyer ce dossier a un confrere
                    </button>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-forest-900 mb-2">Envoyer a un confrere</p>
                      <form onSubmit={searchDoctors} className="flex gap-2 mb-2">
                        <input
                          value={doctorQuery} onChange={(e) => setDoctorQuery(e.target.value)}
                          placeholder="Nom du medecin..."
                          className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm"
                        />
                        <button type="submit" className="rounded-full bg-forest-700 text-white px-4 py-2 text-sm font-medium hover:bg-forest-900 transition">
                          Chercher
                        </button>
                      </form>
                      <input
                        placeholder="Note (optionnel)"
                        value={shareNote} onChange={(e) => setShareNote(e.target.value)}
                        className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-2"
                      />
                      <div className="space-y-1">
                        {doctorResults.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => sendShare(doc.id)}
                            disabled={sharing}
                            className="w-full text-left rounded-lg border border-forest-100 p-2 text-sm hover:border-forest-300 transition disabled:opacity-50"
                          >
                            {doc.full_name} - {doc.specialty}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {patients.length === 0 && <p className="text-forest-700">Aucun patient pour le moment.</p>}
        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => openPatient(p.id)}
            className="w-full text-left rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center hover:border-forest-300 transition"
          >
            <div>
              <p className="text-forest-900 font-medium">{p.full_name}</p>
              <p className="text-sm text-forest-700">Dossier {p.dossier_number} - {p.visits_count} consultation{p.visits_count > 1 ? 's' : ''}</p>
            </div>
            {p.last_visit && (
              <p className="text-xs text-forest-700">Derniere visite: {new Date(p.last_visit).toLocaleDateString('fr-FR')}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
