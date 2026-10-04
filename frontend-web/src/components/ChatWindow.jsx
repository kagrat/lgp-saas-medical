import { useEffect, useRef, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

const POLL_INTERVAL_MS = 6000

/**
 * Fenetre de conversation generique avec rafraichissement automatique.
 * fetchUrl: endpoint GET qui renvoie la liste des messages.
 * sendUrl: endpoint POST pour envoyer un message.
 * currentSenderRole: 'patient' ou 'staff' - determine l'alignement des bulles.
 */
export default function ChatWindow({ fetchUrl, sendUrl, currentSenderRole, title }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function load() {
    try {
      const { data } = await api.get(fetchUrl)
      setMessages(data)
    } catch (err) {
      // silencieux pendant le polling - evite un message d'erreur qui clignote toutes les 6 secondes
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim()) return
    setSending(true)
    setError('')
    try {
      await api.post(sendUrl, { content: input.trim() })
      setInput('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'envoyer ce message."))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-forest-100 bg-white flex flex-col h-[500px]">
      <div className="border-b border-forest-100 px-4 py-3">
        <p className="font-display text-lg text-forest-900 font-semibold">{title}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && <p className="text-sm text-forest-700">Aucun message pour le moment. Écris le premier !</p>}
        {messages.map((m) => {
          const isMine = m.sender_role === currentSenderRole
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? 'bg-primary-700 text-white' : 'bg-forest-50 text-forest-900'}`}>
                {!isMine && <p className="text-xs font-medium mb-0.5 opacity-70">{m.sender_name}</p>}
                <p>{m.content}</p>
                <p className={`text-[10px] mt-1 ${isMine ? 'text-white/70' : 'text-forest-700/70'}`}>
                  {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-clay-600 text-xs px-4">{error}</p>}

      <form onSubmit={handleSend} className="border-t border-forest-100 p-3 flex gap-2">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Écris ton message..."
          className="flex-1 rounded-full border border-forest-100 px-4 py-2 text-sm focus:border-forest-500"
        />
        <button
          type="submit" disabled={sending || !input.trim()}
          className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-semibold hover:brightness-90 transition disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </div>
  )
}
