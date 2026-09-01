import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (demande M. Faustin): permet au personnel d'accueil de creer un
 * patient qui se presente PHYSIQUEMENT, sans email obligatoire - contrairement
 * a l'auto-inscription classique. Le compte cree ne peut pas encore etre
 * utilise par le patient pour se connecter tant qu'un vrai email n'est pas
 * fourni (soit ici, soit plus tard) - c'est normal et attendu.
 */
export default function WalkInPatientForm() {
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', date_of_birth: '', gender: '', residence: '' })
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    setSaving(true)
    try {
      const { data } = await api.post('/patients/walk-in', {
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        residence: form.residence || null,
      })
      setResult(data)
      setForm({ full_name: '', phone: '', email: '', date_of_birth: '', gender: '', residence: '' })
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de creer ce patient."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="text-forest-700 text-sm mb-4">
        Pour un patient qui se presente sans jamais etre passe par la plateforme - aucun email requis.
      </p>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      {result && (
        <div className="rounded-xl border border-forest-300 bg-forest-50 p-4 mb-6">
          <p className="text-forest-900 font-medium">{result.full_name} - dossier {result.dossier_number}</p>
          {!result.has_real_email && (
            <p className="text-sm text-amber-600 mt-1">
              Aucun email fourni: ce patient ne peut pas encore se connecter lui-meme a la plateforme.
              Complete son inscription avec un vrai email des que possible pour qu'il puisse y acceder.
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5">
        <input required placeholder="Nom complet" value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm sm:col-span-2" />
        <input placeholder="Telephone" value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <input type="email" placeholder="Email (optionnel)" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <div>
          <label className="block text-xs text-forest-700 mb-1">Date de naissance (optionnel)</label>
          <input type="date" value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        </div>
        <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm bg-white">
          <option value="">Genre (optionnel)</option>
          <option value="femme">Femme</option>
          <option value="homme">Homme</option>
          <option value="autre">Autre</option>
        </select>
        <input placeholder="Lieu de residence (optionnel)" value={form.residence}
          onChange={(e) => setForm({ ...form, residence: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm sm:col-span-2" />
        <button type="submit" disabled={saving}
          className="sm:col-span-2 rounded-full bg-[var(--portal-accent)] text-white py-2.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
          {saving ? 'Creation...' : 'Creer ce patient'}
        </button>
      </form>
    </div>
  )
}
