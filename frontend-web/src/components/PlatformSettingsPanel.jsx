import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function PlatformSettingsPanel() {
  const [form, setForm] = useState({ platform_name: '', support_email: '', support_phone: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setForm({
        platform_name: data.platform_name || '',
        support_email: data.support_email || '',
        support_phone: data.support_phone || '',
      }))
      .catch((err) => setError(getErrorMessage(err, 'Impossible de charger les parametres.')))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      await api.put('/settings', form)
      setMessage('Parametres mis a jour.')
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de mettre a jour les parametres.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="text-sm text-forest-700 mb-4">
        Reglages généraux de la plateforme. D'autres parametres (paiements, roles avances)
        arriveront quand l'infrastructure correspondante sera en place.
      </p>
      {error && <p className="text-clay-600 mb-4">{error}</p>}
      {message && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-xl p-3 mb-4 text-sm">{message}</p>}
      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-forest-100 rounded-xl p-5 max-w-md">
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Nom de la plateforme</label>
          <input value={form.platform_name} onChange={(e) => setForm({ ...form, platform_name: e.target.value })}
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Email de support</label>
          <input type="email" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })}
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-forest-900 mb-1">Téléphone de support</label>
          <input value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })}
            className="w-full rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500" />
        </div>
        <button type="submit" disabled={saving}
          className="rounded-full bg-forest-700 text-white px-6 py-2.5 font-medium hover:bg-forest-900 transition disabled:opacity-50">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
