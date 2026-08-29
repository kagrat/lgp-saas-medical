import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (mot de passe oublie - lacune de securite identifiee lors d'un
 * audit complet). Reutilisable depuis n'importe quel ecran de connexion
 * (web patient ET desktop personnel) - l'action elle-meme (demander
 * l'envoi d'un email) se fait directement ici, sans avoir besoin de
 * quitter l'ecran de connexion. Seul le LIEN CONTENU DANS L'EMAIL ouvre un
 * vrai navigateur (jamais Electron directement), vers la page web
 * ReinitialiserMotDePasse.jsx.
 */
export default function ForgotPasswordForm({ onClose }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setMessage(data.message)
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'envoyer la demande."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-forest-100 bg-forest-50 p-4">
      {message ? (
        <p className="text-sm text-forest-900">{message}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="text-sm font-medium text-forest-900 mb-2">Mot de passe oublie</p>
          <p className="text-xs text-forest-700 mb-3">
            Indique ton email, on t'envoie un lien pour choisir un nouveau mot de passe.
          </p>
          <div className="flex gap-2">
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm"
            />
            <button type="submit" disabled={loading}
              className="rounded-full bg-primary-700 text-white px-4 py-2 text-sm font-medium hover:bg-primary-900 transition disabled:opacity-50">
              {loading ? '...' : 'Envoyer'}
            </button>
          </div>
          {error && <p className="text-clay-600 text-xs mt-2">{error}</p>}
        </form>
      )}
      {onClose && (
        <button onClick={onClose} className="text-xs text-forest-700 hover:underline mt-2">
          Retour a la connexion
        </button>
      )}
    </div>
  )
}
