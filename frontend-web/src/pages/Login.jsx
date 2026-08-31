import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api, { saveSession, getErrorMessage, consumeSessionExpiredFlag, getLastRoleBeforeExpiry } from '../api/client'
import ForgotPasswordForm from '../components/ForgotPasswordForm'

const ROLE_LABELS = {
  super_admin: 'administrateur',
  establishment_admin: 'etablissement',
  patient: 'patient',
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const lastExpiredRole = getLastRoleBeforeExpiry()
  const wasStaffSession = lastExpiredRole && lastExpiredRole !== 'patient'

  useEffect(() => {
    if (consumeSessionExpiredFlag()) {
      const label = ROLE_LABELS[lastExpiredRole]
      setNotice(label ? `Ta session ${label} a expire. Reconnecte-toi pour continuer.` : 'Ta session a expire. Reconnecte-toi pour continuer.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      saveSession(data.access_token, data.role, data.establishment_id)
      if (data.role === 'super_admin') navigate('/super-admin')
      else if (data.role === 'establishment_admin') navigate('/admin-etablissement')
      else if (data.role === 'patient') navigate('/espace-patient')
      else navigate('/')
    } catch (err) {
      setError(getErrorMessage(err, 'Connexion impossible. Verifie tes identifiants.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div className="max-w-md mx-auto lg:mx-0 w-full">
          <h1 className="font-display text-3xl font-semibold text-forest-900 mb-2">Connexion</h1>
          <p className="text-forest-700 mb-8">
            {wasStaffSession ? 'Reconnecte-toi pour continuer.' : 'Retrouve tes rendez-vous, tes commandes et tes messages.'}
          </p>

          {notice && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-sm">
              {notice}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-forest-900 mb-1">Email</label>
              <input
                id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-forest-900 mb-1">Mot de passe</label>
              <input
                id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
              />
            </div>
            {error && <p className="text-clay-600 text-sm">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full rounded-full bg-primary-700 text-white py-3 font-medium hover:bg-primary-900 transition disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {!showForgotPassword ? (
            <button onClick={() => setShowForgotPassword(true)} className="text-sm text-forest-700 hover:underline mt-4">
              Mot de passe oublie ?
            </button>
          ) : (
            <ForgotPasswordForm onClose={() => setShowForgotPassword(false)} />
          )}

          {!wasStaffSession && (
            <p className="text-sm text-forest-700 mt-6">
              Nouveau patient ?{' '}
              <Link to="/inscription" className="text-amber-600 font-medium hover:underline">Créer un compte</Link>
            </p>
          )}
        </div>

        <div className="hidden lg:block">
          <img
            src="/images/login-background.jpg"
            alt="Établissement de santé"
            className="w-full h-[480px] object-cover rounded-3xl shadow-lg"
          />
        </div>
      </div>
    </div>
  )
}
