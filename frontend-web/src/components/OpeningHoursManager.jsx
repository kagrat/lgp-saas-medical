import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { DAYS_OF_WEEK } from '../constants'

export default function OpeningHoursManager() {
  const [hours, setHours] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ day_of_week: 0, open_time: '08:00', close_time: '18:00' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const { data } = await api.get('/opening-hours/mine')
      setHours(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les horaires.'))
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/opening-hours', {
        day_of_week: Number(form.day_of_week),
        open_time: form.open_time,
        close_time: form.close_time,
      })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter cet horaire."))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entryId) {
    try {
      await api.delete(`/opening-hours/${entryId}`)
      await load()
    } catch (err) {
      setError('Suppression impossible.')
    }
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end bg-white border border-forest-100 rounded-xl p-5 mb-6">
        <div>
          <label className="block text-xs text-forest-700 mb-1">Jour</label>
          <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
            className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
            {DAYS_OF_WEEK.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-forest-700 mb-1">Ouverture</label>
          <input type="time" value={form.open_time} onChange={(e) => setForm({ ...form, open_time: e.target.value })}
            className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-forest-700 mb-1">Fermeture</label>
          <input type="time" value={form.close_time} onChange={(e) => setForm({ ...form, close_time: e.target.value })}
            className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={saving}
          className="rounded-full bg-forest-700 text-white px-5 py-2 text-sm font-medium hover:bg-forest-900 transition disabled:opacity-50">
          {saving ? 'Ajout...' : 'Ajouter'}
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {hours.length === 0 && <p className="text-forest-700 text-sm">Aucun horaire renseigne pour le moment.</p>}
        {hours.map((h) => (
          <div key={h.id} className="flex items-center gap-2 rounded-full bg-forest-50 px-3 py-1.5 text-sm text-forest-900">
            <span>
              {DAYS_OF_WEEK.find((d) => d.value === h.day_of_week)?.label} {h.open_time.slice(0, 5)}-{h.close_time.slice(0, 5)}
            </span>
            <button onClick={() => handleDelete(h.id)} className="text-clay-600 hover:text-clay-500 font-bold" aria-label="Supprimer">
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
