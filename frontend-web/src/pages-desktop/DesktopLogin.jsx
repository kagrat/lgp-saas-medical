import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { saveSession, getErrorMessage, consumeSessionExpiredFlag } from '../api/client'
import ForgotPasswordForm from '../components/ForgotPasswordForm'
import logo from '../assets/logo-transparent.png'

const ROLE_ROUTES = {
  super_admin: '/super-admin',
  establishment_admin: '/admin-etablissement',
  doctor: '/mon-espace-medecin',
  pharmacist: '/mon-espace-pharmacie',
  lab_technician: '/mon-espace-laboratoire',
  secretary: '/mon-espace-secretariat',
  // NOUVEAU (gestion interne complete, demande M. Faustin):
  hr_manager: '/mon-espace-rh',
  nurse: '/mon-espace-infirmier',
  receptionist: '/mon-espace-accueil',
  accountant: '/mon-espace-comptabilite',
}

export default function DesktopLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [requires2FA, setRequires2FA] = useState(false)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  function routeAfterLogin(role) {
    const target = ROLE_ROUTES[role]
    if (target) {
      navigate(target)
    } else {
      setError("Ce type de compte n'a pas encore d'espace dedie sur cette application.")
    }
  }

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
      if (data.requires_2fa) {
        setRequires2FA(true)
      } else {
        saveSession(data.token.access_token, data.token.role, data.token.establishment_id)
        routeAfterLogin(data.token.role)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Connexion impossible. Verifie tes identifiants.'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    setError('')
    setVerifying(true)
    try {
      const { data } = await api.post('/auth/verify-2fa', { email, code })
      saveSession(data.access_token, data.role, data.establishment_id)
      routeAfterLogin(data.role)
    } catch (err) {
      setError(getErrorMessage(err, 'Code invalide ou expire.'))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary-900 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          {/* NOUVEAU (demande explicite de M. Faustin: "voici le logo de
              speedsante+ que tu vas utiliser dans le systeme"). */}
          <div className="bg-white rounded-xl px-4 py-2.5 inline-block">
            <img src={logo} alt="SpeedSanté+" className="h-9 w-auto" />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-8">
          <h1 className="font-display text-2xl text-forest-900 font-semibold mb-1">Espace établissement</h1>
          <p className="text-forest-700 text-sm mb-6">Réserve aux établissements adhérents et a l'administration SpeedSanté+.</p>

          {notice && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm">
              {notice}
            </p>
          )}

          <form onSubmit={requires2FA ? handleVerifyCode : handleSubmit} className="space-y-4">
            {!requires2FA ? (
              <>
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
              </>
            ) : (
              <div>
                <p className="text-sm text-forest-700 mb-3">
                  Un code de verification vient d'etre envoye a {email}. Saisis-le ci-dessous.
                </p>
                <label htmlFor="code" className="block text-sm font-medium text-forest-900 mb-1">Code a 6 chiffres</label>
                <input
                  id="code" type="text" inputMode="numeric" maxLength={6} required value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500 text-center text-2xl tracking-widest"
                />
              </div>
            )}
            {error && <p className="text-clay-600 text-sm">{error}</p>}
            <button
              type="submit" disabled={requires2FA ? verifying : loading}
              className="w-full rounded-full bg-primary-700 text-white py-3 font-medium hover:bg-primary-900 transition disabled:opacity-50"
            >
              {requires2FA ? (verifying ? 'Verification...' : 'Verifier le code') : (loading ? 'Connexion...' : 'Se connecter')}
            </button>
          </form>

          {!showForgotPassword ? (
            <button onClick={() => setShowForgotPassword(true)} className="text-sm text-forest-700 hover:underline mt-4">
              Mot de passe oublie ?
            </button>
          ) : (
            <ForgotPasswordForm onClose={() => setShowForgotPassword(false)} />
          )}
        </div>
        <p className="text-center text-forest-300 text-xs mt-6">SpeedSanté+ - Console de gestion</p>
      </div>
    </div>
  )
}
