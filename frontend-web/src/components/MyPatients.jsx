import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { DocumentTypeBadge, SELECTABLE_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from './DocumentType'
import PrescriptionItemsEditor from './PrescriptionItemsEditor'
import { downloadDocumentAsPdf } from '../utils/pdf'

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  const diff = Date.now() - dob.getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

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
  const [panelTab, setPanelTab] = useState('consultation')
  const [newFlagType, setNewFlagType] = useState('other')
  const [newFlagLabel, setNewFlagLabel] = useState('')
  const [savingFlag, setSavingFlag] = useState(false)

  const [docForm, setDocForm] = useState({ appointment_id: '', document_type: 'consultation_note', title: '', content: '' })
  const [prescriptionItems, setPrescriptionItems] = useState([])
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
    setPanelTab('consultation')
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

  async function addClinicalFlag() {
    if (!newFlagLabel.trim()) return
    setSavingFlag(true)
    setError('')
    try {
      await api.post(`/doctors/patients/${selectedId}/clinical-flags`, { flag_type: newFlagType, label: newFlagLabel })
      setNewFlagLabel('')
      const { data } = await api.get(`/doctors/me/patients/${selectedId}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter cet element clinique."))
    } finally {
      setSavingFlag(false)
    }
  }

  async function removeClinicalFlag(flagId) {
    try {
      await api.delete(`/doctors/patients/${selectedId}/clinical-flags/${flagId}`)
      const { data } = await api.get(`/doctors/me/patients/${selectedId}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Suppression impossible.'))
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
      const validItems = prescriptionItems.filter((it) => it.medication_name.trim())
      await api.post('/health-records', {
        appointment_id: docForm.appointment_id,
        document_type: docForm.document_type,
        title: docForm.title,
        content: docForm.content,
        prescription_items: docForm.document_type === 'prescription' && validItems.length > 0
          ? validItems.map((it) => ({ medication_name: it.medication_name, quantity: Number(it.quantity) || 1, dosage_instructions: it.dosage_instructions || null }))
          : null,
      })
      setDocMessage('Ajoute au dossier du patient.')
      setDocForm({ ...docForm, title: '', content: '' })
      setPrescriptionItems([])
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

  function downloadDocument(doc) {
    downloadDocumentAsPdf({
      title: doc.title, subtitle: DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type,
      meta: [
        `Patient: ${detail?.full_name || ''}`, `Medecin: ${doc.doctor_name}`,
        `Date: ${new Date(doc.created_at).toLocaleDateString('fr-FR')}`,
      ],
      content: doc.content, filename: `${doc.title.replace(/[^a-z0-9]/gi, '_')}.pdf`,
    })
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
        <button type="submit" className="rounded-full bg-[var(--portal-accent)] text-white px-6 py-2.5 font-medium hover:brightness-90 transition">
          Rechercher
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {selectedId && (
        <div className="rounded-2xl border border-forest-100 bg-white shadow-sm mb-4 overflow-hidden">
          {loadingDetail && <p className="text-sm text-forest-700 p-5">Chargement...</p>}
          {detail && (
            <div>
              {/* NOUVEAU (demande M. Faustin): en-tete façon carte patient,
                  avec age/telephone quand disponibles, comme sur la
                  maquette de reference. */}
              <div className="flex justify-between items-start p-5 border-b border-forest-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-secondary-500/10 text-secondary-600 flex items-center justify-center font-display text-xl font-semibold shrink-0">
                    {detail.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-display text-lg text-forest-900 font-semibold">{detail.full_name}</p>
                    <p className="text-sm text-forest-700">
                      {calculateAge(detail.date_of_birth) !== null && `${calculateAge(detail.date_of_birth)} ans - `}
                      Dossier {detail.dossier_number}
                    </p>
                    {detail.phone && <p className="text-sm text-forest-700">Tél. : {detail.phone}</p>}
                    {detail.viewed_via_share_from && (
                      <p className="text-xs text-amber-600 font-medium mt-1">
                        Dossier consulte en lecture seule - partage par {detail.viewed_via_share_from}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={closePatient} className="text-sm text-forest-700 hover:text-forest-900 hover:underline">Fermer</button>
              </div>

              <div className="flex gap-1 px-5 border-b border-forest-100">
                {[
                  { id: 'consultation', label: 'Consultation' },
                  { id: 'historique', label: 'Historique' },
                  { id: 'documents', label: 'Documents' },
                  { id: 'messages', label: 'Messages' },
                ].map((t) => (
                  <button
                    key={t.id} onClick={() => setPanelTab(t.id)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${panelTab === t.id ? 'border-secondary-500 text-forest-900' : 'border-transparent text-forest-700 hover:text-forest-900'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {error && <p className="text-clay-600 mb-4">{error}</p>}

                {panelTab === 'consultation' && (
                  <div>
                    {/* NOUVEAU (demande M. Faustin, comme sur la maquette de
                        reference): elements cliniques - visibles par tout
                        medecin ayant acces au dossier, mais seul le medecin
                        traitant peut en ajouter/retirer. */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-forest-900 mb-2">Éléments cliniques</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {detail.clinical_flags.length === 0 && (
                          <p className="text-sm text-forest-700">Aucun element clinique renseigne.</p>
                        )}
                        {detail.clinical_flags.map((f) => (
                          <span key={f.id} className="inline-flex items-center gap-1.5 text-sm bg-forest-50 text-forest-900 px-3 py-1 rounded-full">
                            {f.label}
                            {detail.can_add_document && (
                              <button onClick={() => removeClinicalFlag(f.id)} className="text-clay-600 hover:text-clay-500 font-bold" aria-label="Retirer">
                                x
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                      {detail.can_add_document && (
                        <div className="flex gap-2">
                          <select value={newFlagType} onChange={(e) => setNewFlagType(e.target.value)}
                            className="rounded-lg border border-forest-100 px-2 py-1.5 text-sm bg-white">
                            <option value="allergy">Allergie</option>
                            <option value="antecedent">Antecedent</option>
                            <option value="other">Autre</option>
                          </select>
                          <input placeholder="Ex: Penicilline, Diabete type 2..." value={newFlagLabel}
                            onChange={(e) => setNewFlagLabel(e.target.value)}
                            className="flex-1 rounded-lg border border-forest-100 px-3 py-1.5 text-sm" />
                          <button onClick={addClinicalFlag} disabled={savingFlag || !newFlagLabel.trim()}
                            className="rounded-full bg-[var(--portal-accent)] text-white px-4 py-1.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
                            {savingFlag ? '...' : '+ Ajouter'}
                          </button>
                        </div>
                      )}
                    </div>

                    {detail.can_add_document ? (
                      <div className="bg-forest-50 rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium text-forest-900 mb-2">Notes de consultation / Ordonnance</p>
                        {docMessage && <p className="text-forest-900 bg-white border border-forest-300 rounded-lg p-2 mb-3 text-sm">{docMessage}</p>}
                        <div className="grid sm:grid-cols-2 gap-3 mb-3">
                          <select
                            value={docForm.appointment_id}
                            onChange={(e) => setDocForm({ ...docForm, appointment_id: e.target.value })}
                            className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white"
                          >
                            {detail.appointments.map((a) => (
                              <option key={a.id} value={a.id}>Consultation du {new Date(a.scheduled_at).toLocaleDateString('fr-FR')}</option>
                            ))}
                          </select>
                          <select
                            value={docForm.document_type}
                            onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })}
                            className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white"
                          >
                            {SELECTABLE_DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
                          </select>
                        </div>
                        {docForm.document_type === 'prescription' && (
                          <PrescriptionItemsEditor items={prescriptionItems} onChange={setPrescriptionItems} />
                        )}
                        <input
                          placeholder="Motif / titre (ex: Suivi general, Ordonnance du 21 mai)"
                          value={docForm.title}
                          onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                          className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3"
                        />
                        <textarea
                          placeholder="Notes de consultation (observations, traitement, diagnostic...)"
                          value={docForm.content}
                          onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                          rows={4}
                          className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3"
                        />
                        <button
                          onClick={submitDocument}
                          disabled={savingDoc || !docForm.appointment_id || !docForm.title || !docForm.content}
                          className="rounded-full bg-secondary-500 text-white px-5 py-1.5 text-sm font-semibold hover:bg-secondary-600 transition disabled:opacity-50"
                        >
                          {savingDoc ? 'Enregistrement...' : 'Ajouter au dossier'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-forest-700 mb-4">Dossier en lecture seule - impossible d'ajouter une note depuis un partage recu.</p>
                    )}

                    {detail.can_add_document && (
                      <div className="bg-forest-50 rounded-lg p-4">
                        {shareMessage && <p className="text-forest-900 text-sm mb-2">{shareMessage}</p>}
                        {!shareOpen ? (
                          <button onClick={() => setShareOpen(true)} className="text-sm text-secondary-600 font-medium hover:underline">
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
                              <button type="submit" className="rounded-full bg-[var(--portal-accent)] text-white px-4 py-2 text-sm font-medium hover:brightness-90 transition">
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
                                  key={doc.id} onClick={() => sendShare(doc.id)} disabled={sharing}
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

                {panelTab === 'historique' && (
                  <div>
                    <p className="text-sm font-medium text-forest-900 mb-2">Consultations passees</p>
                    {detail.appointments.length === 0 && <p className="text-sm text-forest-700">Aucun rendez-vous.</p>}
                    <div className="space-y-1">
                      {detail.appointments.map((a) => (
                        <p key={a.id} className="text-sm text-forest-700">{new Date(a.scheduled_at).toLocaleString('fr-FR')}</p>
                      ))}
                    </div>
                  </div>
                )}

                {panelTab === 'documents' && (
                  <div>
                    <p className="text-sm font-medium text-forest-900 mb-2">Documents du dossier</p>
                    {detail.documents.length === 0 && <p className="text-sm text-forest-700">Aucun document.</p>}
                    <div className="space-y-2">
                      {detail.documents.map((d) => (
                        <div key={d.id} className="bg-forest-50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-sm text-forest-900 font-medium">{d.title}</p>
                            <div className="flex items-center gap-3">
                              <DocumentTypeBadge type={d.document_type} />
                              {/* NOUVEAU (demande M. Faustin): le medecin peut
                                  desormais telecharger un document depuis
                                  son propre espace, pas seulement le patient. */}
                              <button onClick={() => downloadDocument(d)} className="text-xs text-secondary-600 hover:underline">
                                Telecharger
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-forest-700 mb-1">{d.doctor_name} - {new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
                          <p className="text-sm text-forest-700 whitespace-pre-wrap">{d.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {panelTab === 'messages' && (
                  <p className="text-sm text-forest-700">Utilise l'onglet "Messages" du menu pour contacter ce patient directement.</p>
                )}
              </div>
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
