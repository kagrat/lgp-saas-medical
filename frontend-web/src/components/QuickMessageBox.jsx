import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (demande explicite de M. Faustin, manque trouve lors d'un audit
 * complet: "il faut ouvrir la possibilite d'envoyer le message sans pour
 * autant aller dans l'onglet de message" - depuis le dossier de
 * consultation directement). La conversation apparait ensuite dans
 * l'onglet Messages normalement, puisqu'elle utilise le meme systeme.
 */
export default function QuickMessageBox({ patientId }) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSend(e) {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    setError('')
    try {
      await api.post(`/messages/establishment/conversation/${patientId}`, { content })
      setContent('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'envoyer ce message."))
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-sm rounded-full border border-secondary-500 text-secondary-600 px-4 py-1.5 hover:bg-forest-50 transition">
        Envoyer un message
      </button>
    )
  }

  return (
    <form onSubmit={handleSend} className="flex items-center gap-2 w-full">
      <input
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Écrire au patient..."
        className="flex-1 rounded-full border border-forest-100 px-4 py-1.5 text-sm"
      />
      <button type="submit" disabled={sending || !content.trim()}
        className="rounded-full bg-[var(--portal-accent)] text-white px-4 py-1.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
        {sending ? '...' : 'Envoyer'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-forest-700 hover:underline">
        Fermer
      </button>
      {sent && <span className="text-xs text-forest-700">Envoyé ✓</span>}
      {error && <span className="text-xs text-clay-600">{error}</span>}
    </form>
  )
}
