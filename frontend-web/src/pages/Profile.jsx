import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [infoForm, setInfoForm] = useState({ full_name: '', phone: '', email: '' })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/auth/me')
      setProfile(data)
      setInfoForm({ full_name: data.full_name, phone: data.phone || '', email: data.email })
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger ton profil.'))
    }
  }

  async function handleInfoSubmit(e) {
    e.preventDefault()
    setError('')
    setInfoMessage('')
    setSavingInfo(true)
    try {
      const { data } = await api.patch('/auth/me', infoForm)
      setProfile(data)
      setInfoMessage('Informations mises a jour.')
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de mettre a jour tes informations.'))
    } finally {
      setSavingInfo(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError('')
    setPasswordMessage('')

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSavingPassword(true)
    try {
      await api.post('/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      setPasswordMessage('Mot de passe modifie avec succes.')
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de modifier le mot de passe.'))
    } finally {
      setSavingPassword(false)
    }
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-14">
        {error ? <p className="text-clay-600">{error}</p> : <p className="text-forest-700">Chargement...</p>}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Mon profil</h1>

      {error && <p className="text-clay-600 mb-6">{error}</p>}

      <section className="mb-10">
        <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Mes informations</h2>
        {infoMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-xl p-3 mb-4 text-sm">{infoMessage}</p>}
        <form onSubmit={handleInfoSubmit} className="space-y-4 bg-white border border-forest-100 rounded-xl p-5">
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Nom complet</label>
            <input required value={infoForm.full_name} onChange={(e) => setInfoForm({ ...infoForm, full_name: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Telephone</label>
            <input value={infoForm.phone} onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
              placeholder="+229 ..."
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Email</label>
            <input required type="email" value={infoForm.email} onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <button type="submit" disabled={savingInfo}
            className="rounded-full bg-forest-700 text-white px-6 py-2.5 font-medium hover:bg-forest-900 transition disabled:opacity-50">
            {savingInfo ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Changer mon mot de passe</h2>
        {passwordMessage && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-xl p-3 mb-4 text-sm">{passwordMessage}</p>}
        <form onSubmit={handlePasswordSubmit} className="space-y-4 bg-white border border-forest-100 rounded-xl p-5">
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Mot de passe actuel</label>
            <input required type="password" value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Nouveau mot de passe</label>
            <input required type="password" value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
            <p className="text-xs text-forest-700 mt-1">Min. 8 caracteres, une majuscule, un chiffre.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-900 mb-1">Confirmer le nouveau mot de passe</label>
            <input required type="password" value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          </div>
          <button type="submit" disabled={savingPassword}
            className="rounded-full bg-amber-500 text-forest-900 px-6 py-2.5 font-semibold hover:bg-amber-400 transition disabled:opacity-50">
            {savingPassword ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </section>
    </div>
  )
}
