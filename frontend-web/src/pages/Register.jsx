import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { saveSession, getErrorMessage } from '../api/client'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', gender: '', residence: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register-patient', form)
      saveSession(data.access_token, data.role, null)
      navigate('/espace-patient')
    } catch (err) {
      setError(getErrorMessage(err, 'Inscription impossible.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-2">Creer un compte patient</h1>
      <p className="text-forest-700 mb-8">Prends rendez-vous en ligne et reserve tes medicaments en quelques clics.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Nom complet</label>
          <input required value={form.full_name} onChange={(e) => update('full_name', e.target.value)}
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Email</label>
          <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)}
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Telephone</label>
          <input value={form.phone} onChange={(e) => update('phone', e.target.value)}
            placeholder="+229 ..."
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Sexe</label>
          <select value={form.gender} onChange={(e) => update('gender', e.target.value)}
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500 bg-white">
            <option value="">Ne pas preciser</option>
            <option value="femme">Femme</option>
            <option value="homme">Homme</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Lieu de residence</label>
          <input value={form.residence} onChange={(e) => update('residence', e.target.value)}
            placeholder="Ville, quartier..."
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Mot de passe</label>
          <input type="password" required value={form.password} onChange={(e) => update('password', e.target.value)}
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
          <p className="text-xs text-forest-700 mt-1">Min. 8 caracteres, une majuscule, un chiffre.</p>
        </div>
        {error && <p className="text-clay-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-full bg-amber-500 text-forest-900 py-3 font-semibold hover:bg-amber-400 transition disabled:opacity-50">
          {loading ? 'Creation...' : 'Creer mon compte'}
        </button>
      </form>
    </div>
  )
}
