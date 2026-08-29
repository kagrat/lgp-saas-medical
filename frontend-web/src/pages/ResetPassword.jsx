import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (mot de passe oublie): page ouverte via le lien recu par email
 * (contient ?token=...). Fonctionne pour TOUT type de compte (patient ou
 * personnel) - le lien ouvre toujours un navigateur classique, jamais
 * l'application desktop directement, donc cette page vit dans l'app web
 * (index.html) qui est universellement accessible.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    if (!token) {
      setError('Lien invalide - le jeton de reinitialisation est manquant.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: newPassword })
      setSuccess(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Ce lien est invalide ou a expire. Demande un nouveau lien depuis la page de connexion.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-2">Nouveau mot de passe</h1>

      {success ? (
        <div>
          <p className="text-forest-700 mb-6">Ton mot de passe a ete reinitialise avec succes.</p>
          <Link to="/connexion" className="rounded-full bg-forest-700 text-white px-6 py-2.5 font-medium hover:bg-forest-900 transition inline-block">
            Se connecter
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-forest-700 mb-4">Choisis un nouveau mot de passe (au moins 8 caracteres, avec un chiffre et une majuscule).</p>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Nouveau mot de passe</label>
            <input
              type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Confirme le mot de passe</label>
            <input
              type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
            />
          </div>
          {error && <p className="text-clay-600 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full rounded-full bg-forest-700 text-white py-3 font-medium hover:bg-forest-900 transition disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Reinitialiser le mot de passe'}
          </button>
        </form>
      )}
    </div>
  )
}
