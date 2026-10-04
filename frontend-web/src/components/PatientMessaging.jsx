import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import StartConversation from './StartConversation'

/**
 * NOUVEAU (demande explicite de M. Faustin: "il faut permettre aussi
 * dans l'onglet messages du menu au medecin et aux autres utilisateurs
 * d'envoyer des messages aux patients"). Composant partage - autonome,
 * a deposer dans n'importe quel tableau de bord de personnel, pour eviter
 * de dupliquer la meme logique partout.
 */
export default function PatientMessaging() {
  const [conversations, setConversations] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [selectedPatientName, setSelectedPatientName] = useState(null)
  const [thread, setThread] = useState([])
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (selectedPatientId) loadThread(selectedPatientId)
  }, [selectedPatientId])

  async function loadConversations() {
    try {
      const { data } = await api.get('/messages/establishment/patients')
      setConversations(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les conversations.'))
    }
  }

  async function loadThread(patientId) {
    try {
      const { data } = await api.get(`/messages/establishment/conversation/${patientId}`)
      setThread(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger cette conversation.'))
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!content.trim() || !selectedPatientId) return
    setSending(true)
    setError('')
    try {
      await api.post(`/messages/establishment/conversation/${selectedPatientId}`, { content })
      setContent('')
      await loadThread(selectedPatientId)
      await loadConversations()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'envoyer ce message."))
    } finally {
      setSending(false)
    }
  }

  const selectedConversation = conversations.find((c) => c.patient_id === selectedPatientId)
    || (selectedPatientId && selectedPatientName ? { patient_id: selectedPatientId, patient_name: selectedPatientName } : null)

  return (
    <div>
      <div className="mb-4">
        <StartConversation
          searchFn={async (query) => {
            const { data } = await api.get('/patients/establishment', { params: query ? { search: query } : {} })
            return data.map((p) => ({ patient_id: p.id, full_name: p.full_name }))
          }}
          onStart={(p) => { setSelectedPatientId(p.patient_id); setSelectedPatientName(p.full_name) }}
        />
      </div>

      {error && <p className="text-clay-600 text-sm mb-3">{error}</p>}

      {/* Regle de confidentialite (decision de M. Faustin): chaque conversation
          reste entre les deux personnes qui conversent. */}
      <p className="text-xs text-forest-700 mb-3">
        Tes conversations avec les patients sont privées : seuls toi et le patient peuvent les lire.
      </p>
      {conversations.length === 0 && !selectedConversation ? (
        <p className="text-forest-700">Aucune conversation pour le moment.</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            {conversations.map((c) => (
              <button key={c.patient_id} onClick={() => { setSelectedPatientId(c.patient_id); setSelectedPatientName(c.patient_name) }}
                className={`w-full text-left rounded-xl border p-3 transition ${selectedPatientId === c.patient_id ? 'border-primary-500 bg-primary-50' : 'border-forest-100 bg-white hover:border-forest-300'}`}>
                <p className="text-forest-900 font-medium text-sm">{c.patient_name}</p>
                {c.last_message && <p className="text-xs text-forest-700 truncate mt-1">{c.last_message}</p>}
              </button>
            ))}
          </div>

          <div className="sm:col-span-2">
            {selectedConversation ? (
              <div className="rounded-xl border border-forest-100 bg-white flex flex-col h-[420px]">
                <div className="px-4 py-3 border-b border-forest-100">
                  <p className="text-forest-900 font-medium">{selectedConversation.patient_name}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {thread.map((m) => (
                    <div key={m.id} className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_role === 'patient' ? 'bg-forest-50 text-forest-900' : 'bg-[var(--portal-accent)] text-white ml-auto'}`}>
                      {m.content}
                    </div>
                  ))}
                </div>
                <form onSubmit={sendMessage} className="p-3 border-t border-forest-100 flex gap-2">
                  <input value={content} onChange={(e) => setContent(e.target.value)}
                    placeholder="Écrire au patient..."
                    className="flex-1 rounded-full border border-forest-100 px-4 py-2 text-sm" />
                  <button type="submit" disabled={sending || !content.trim()}
                    className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
                    Envoyer
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-forest-700 text-sm">Choisis une conversation ou démarre-en une nouvelle.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
