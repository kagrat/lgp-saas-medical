import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { saveSession, getErrorMessage, consumeSessionExpiredFlag } from '../api/client'

const ROLE_ROUTES = {
  super_admin: '/super-admin',
  establishment_admin: '/admin-etablissement',
  doctor: '/mon-espace-medecin',
  pharmacist: '/mon-espace-pharmacie',
  lab_technician: '/mon-espace-laboratoire',
  secretary: '/mon-espace-secretariat',
}

export default function DesktopLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (consumeSessionExpiredFlag()) {
      setNotice('Ta session a expire. Reconnecte-toi pour continuer.')
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      saveSession(data.access_token, data.role, data.establishment_id)
      const target = ROLE_ROUTES[data.role]
      if (target) {
        navigate(target)
      } else {
        // CORRECTIF: avant, un role sans espace dedie renvoyait
        // silencieusement a la connexion, sans explication.
        setError("Ce type de compte n'a pas encore d'espace dedie sur cette application.")
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Connexion impossible. Verifie tes identifiants.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-forest-900 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span className="w-3 h-3 rounded-full bg-amber-500" aria-hidden="true"></span>
          <span className="font-display text-2xl font-semibold text-white">LGP Console</span>
        </div>
        <div className="bg-white rounded-2xl p-8">
          <h1 className="font-display text-2xl text-forest-900 font-semibold mb-1">Espace etablissement</h1>
          <p className="text-forest-700 text-sm mb-6">Reserve aux etablissements adherents et a l'administration LGP HOLDINGS.</p>

          {notice && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm">
              {notice}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-forest-900 mb-1">Email professionnel</label>
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
              className="w-full rounded-full bg-forest-700 text-white py-3 font-medium hover:bg-forest-900 transition disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
        <p className="text-center text-forest-300 text-xs mt-6">LGP HOLDINGS - Console de gestion</p>
      </div>
    </div>
  )
}
