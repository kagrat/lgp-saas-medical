import { useEffect, useState } from 'react'
import api, { getErrorMessage, getRole } from '../api/client'
import StartConversation from './StartConversation'

/**
 * NOUVEAU (demande explicite de M. Faustin: "il faut que l'ets puisse
 * envoyer des messages aux medecins"). Messagerie interne entre membres
 * du personnel d'un meme etablissement - distincte de la messagerie
 * patient <-> etablissement.
 *
 * La recherche "Nouvelle conversation" n'est proposee qu'aux roles ayant
 * reellement acces a l'annuaire du personnel (admin/RH, meme regle que
 * /establishments/staff cote serveur) - un medecin peut neanmoins
 * repondre a toute conversation deja entamee par l'un d'eux.
 */
export default function InternalMessaging() {
  const role = getRole()
  const canSearchStaff = role === 'establishment_admin' || role === 'hr_manager'
  const [conversations, setConversations] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedUserName, setSelectedUserName] = useState(null)
  const [thread, setThread] = useState([])
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (selectedUserId) loadThread(selectedUserId)
  }, [selectedUserId])

  async function loadConversations() {
    try {
      const { data } = await api.get('/messages/internal/mine')
      setConversations(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les conversations.'))
    }
  }

  async function loadThread(userId) {
    try {
      const { data } = await api.get(`/messages/internal/conversation/${userId}`)
      setThread(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger cette conversation.'))
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!content.trim() || !selectedUserId) return
    setSending(true)
    setError('')
    try {
      await api.post(`/messages/internal/conversation/${selectedUserId}`, { content })
      setContent('')
      await loadThread(selectedUserId)
      await loadConversations()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'envoyer ce message."))
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      {canSearchStaff && (
        <div className="mb-4">
          <StartConversation
            searchFn={async () => {
              const { data } = await api.get('/establishments/staff')
              return data.map((s) => ({ patient_id: s.id, full_name: `${s.full_name} (${s.role})` }))
            }}
            onStart={(p) => { setSelectedUserId(p.patient_id); setSelectedUserName(p.full_name) }}
          />
        </div>
      )}

      {error && <p className="text-clay-600 text-sm mb-3">{error}</p>}

      {conversations.length === 0 && !selectedUserId ? (
        <p className="text-forest-700">Aucune conversation interne pour le moment.</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            {conversations.map((c) => (
              <button key={c.other_user_id} onClick={() => { setSelectedUserId(c.other_user_id); setSelectedUserName(c.other_user_name) }}
                className={`w-full text-left rounded-xl border p-3 transition ${selectedUserId === c.other_user_id ? 'border-primary-500 bg-primary-50' : 'border-forest-100 bg-white hover:border-forest-300'}`}>
                <div className="flex justify-between items-start">
                  <p className="text-forest-900 font-medium text-sm">{c.other_user_name}</p>
                  {c.unread_count > 0 && (
                    <span className="bg-amber-500 text-forest-900 text-xs font-semibold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5">
                      {c.unread_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-forest-700">{c.other_user_role}</p>
                {c.last_message && <p className="text-xs text-forest-700 truncate mt-1">{c.last_message}</p>}
              </button>
            ))}
          </div>

          <div className="sm:col-span-2">
            {selectedUserId ? (
              <div className="rounded-xl border border-forest-100 bg-white flex flex-col h-[420px]">
                <div className="px-4 py-3 border-b border-forest-100">
                  <p className="text-forest-900 font-medium">{selectedUserName}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {thread.map((m) => (
                    <div key={m.id} className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.from_user_id === selectedUserId ? 'bg-forest-50 text-forest-900' : 'bg-[var(--portal-accent)] text-white ml-auto'}`}>
                      {m.content}
                    </div>
                  ))}
                </div>
                <form onSubmit={sendMessage} className="p-3 border-t border-forest-100 flex gap-2">
                  <input value={content} onChange={(e) => setContent(e.target.value)}
                    placeholder="Écrire un message..."
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
