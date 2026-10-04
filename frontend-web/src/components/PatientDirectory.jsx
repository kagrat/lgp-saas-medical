import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { DocumentTypeBadge } from './DocumentType'

/**
 * CORRIGE (demande explicite de M. Faustin, relecture rigoureuse: "les
 * dossiers au niveau de la partie Patients [cote etablissement] donnent
 * la main comme au niveau des medecins lorsque le dossier n'est pas...
 * pris en charge en cours"). Avant: simple resume (nombre de commandes,
 * nombre d'analyses) - aucune richesse comparable au dossier medecin.
 * Reutilise le MEME endpoint riche que MyPatients.jsx
 * (/doctors/me/patients/{id}, desormais ouvert a l'admin), mais TOUJOURS
 * en lecture seule pour le clinique (can_add_document reste force a
 * False cote serveur pour ce role - une decision clinique reste
 * reservee au medecin traitant). La messagerie, elle, reste pleinement
 * active - deja elargie a l'admin par ailleurs.
 */
export default function PatientDirectory() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [panelTab, setPanelTab] = useState('consultation')

  const [conversationThread, setConversationThread] = useState(null)
  const [conversationContent, setConversationContent] = useState('')
  const [sendingConversation, setSendingConversation] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load(query) {
    try {
      const { data } = await api.get('/patients/establishment', { params: query ? { search: query } : {} })
      setPatients(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le répertoire des patients.'))
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    load(search)
  }

  async function openPatient(patient) {
    setSelectedId(patient.id)
    setDetail(null)
    setPanelTab('consultation')
    setConversationThread(null)
    setLoadingDetail(true)
    setError('')
    try {
      const { data } = await api.get(`/doctors/me/patients/${patient.id}`)
      setDetail(data)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de charger la fiche de ce patient."))
    } finally {
      setLoadingDetail(false)
    }
  }

  function closePatient() {
    setSelectedId(null)
    setDetail(null)
    setConversationThread(null)
  }

  async function loadConversationThread() {
    try {
      const { data } = await api.get(`/messages/establishment/conversation/${selectedId}`)
      setConversationThread(data)
    } catch (err) {
      setConversationThread([])
    }
  }

  async function sendConversationMessage(e) {
    e.preventDefault()
    if (!conversationContent.trim()) return
    setSendingConversation(true)
    try {
      await api.post(`/messages/establishment/conversation/${selectedId}`, { content: conversationContent })
      setConversationContent('')
      await loadConversationThread()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'envoyer ce message."))
    } finally {
      setSendingConversation(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un patient par nom..."
          className="flex-1 rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
        />
        <button type="submit" className="rounded-full bg-[var(--portal-accent)] text-white px-6 py-2.5 font-medium hover:brightness-90 transition">
          Rechercher
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {selectedId && (
        <div className="rounded-xl border border-forest-300 bg-white mb-6 overflow-hidden">
          {loadingDetail ? (
            <p className="text-sm text-forest-700 p-5">Chargement...</p>
          ) : detail && (
            <div>
              <div className="flex justify-between items-start p-5 border-b border-forest-100">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-full bg-forest-50 flex items-center justify-center text-forest-900 font-display font-semibold text-lg shrink-0">
                    {detail.full_name?.charAt(0)}
                  </span>
                  <div>
                    <p className="font-display text-lg text-forest-900 font-semibold">{detail.full_name}</p>
                    <p className="text-sm text-forest-700">
                      Dossier {detail.dossier_number}{detail.phone ? ` - Tél. : ${detail.phone}` : ''}
                    </p>
                    {detail.currently_with_doctor && (
                      <p className="text-xs text-amber-600 font-medium mt-1">
                        Actuellement en consultation avec {detail.currently_with_doctor}
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
                    key={t.id}
                    onClick={() => {
                      setPanelTab(t.id)
                      if (t.id === 'messages' && conversationThread === null) loadConversationThread()
                    }}
                    className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${panelTab === t.id ? 'border-secondary-500 text-forest-900' : 'border-transparent text-forest-700 hover:text-forest-900'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {panelTab === 'consultation' && (
                  <div>
                    <p className="text-sm font-medium text-forest-900 mb-2">Éléments cliniques</p>
                    <p className="text-xs text-forest-500 mb-2">Lecture seule - la modification reste réservée au médecin traitant.</p>
                    {detail.clinical_flags.length === 0 ? (
                      <p className="text-sm text-forest-700 mb-4">Aucun élément clinique renseigné.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {detail.clinical_flags.map((f) => (
                          <span key={f.id} className="text-xs px-3 py-1 rounded-full bg-forest-50 text-forest-900">{f.label}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {panelTab === 'historique' && (
                  <div>
                    <p className="text-sm font-medium text-forest-900 mb-2">Consultations passées</p>
                    {detail.appointments.length === 0 && <p className="text-sm text-forest-700">Aucune consultation enregistrée.</p>}
                    <div className="space-y-2">
                      {detail.appointments.map((a) => (
                        <div key={a.id} className="bg-forest-50 rounded-lg p-3 text-sm text-forest-900">
                          {new Date(a.scheduled_at).toLocaleString('fr-FR')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {panelTab === 'documents' && (
                  <div>
                    <p className="text-sm font-medium text-forest-900 mb-2">Documents du dossier</p>
                    {detail.documents.length === 0 && <p className="text-sm text-forest-700">Aucun document pour le moment.</p>}
                    <div className="space-y-2">
                      {detail.documents.map((d) => (
                        <div key={d.id} className="bg-forest-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <DocumentTypeBadge type={d.document_type} />
                            <p className="text-sm font-medium text-forest-900">{d.title}</p>
                          </div>
                          <p className="text-xs text-forest-700 mb-1">{d.doctor_name} - {new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
                          <p className="text-sm text-forest-700 whitespace-pre-wrap">{d.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {panelTab === 'messages' && (
                  <div>
                    {conversationThread === null ? (
                      <p className="text-sm text-forest-700">Chargement...</p>
                    ) : (
                      <div className="rounded-xl border border-forest-100 bg-white flex flex-col h-[380px]">
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                          {conversationThread.length === 0 && (
                            <p className="text-sm text-forest-700">Aucun message pour le moment - écris le premier ci-dessous.</p>
                          )}
                          {conversationThread.map((m) => (
                            <div key={m.id} className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_role === 'patient' ? 'bg-forest-50 text-forest-900' : 'bg-[var(--portal-accent)] text-white ml-auto'}`}>
                              {m.content}
                            </div>
                          ))}
                        </div>
                        <form onSubmit={sendConversationMessage} className="p-3 border-t border-forest-100 flex gap-2">
                          <input value={conversationContent} onChange={(e) => setConversationContent(e.target.value)}
                            placeholder="Écrire au patient..."
                            className="flex-1 rounded-full border border-forest-100 px-4 py-2 text-sm" />
                          <button type="submit" disabled={sendingConversation || !conversationContent.trim()}
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

      <div className="space-y-2">
        {patients.length === 0 && <p className="text-forest-700">Aucun patient trouvé.</p>}
        {patients.map((p) => (
          <button
            key={p.id}
            onClick={() => openPatient(p)}
            className="w-full text-left rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center hover:border-forest-300 transition"
          >
            <div>
              <p className="text-forest-900 font-medium">{p.full_name}</p>
              <p className="text-sm text-forest-700">
                Dossier {p.dossier_number} - {p.email}{p.phone ? ` - ${p.phone}` : ''}
              </p>
            </div>
            {p.last_visit && (
              <p className="text-xs text-forest-700">
                Dernière visite: {new Date(p.last_visit).toLocaleDateString('fr-FR')}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
