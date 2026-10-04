import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (demande M. Faustin): permet de completer l'inscription d'un
 * patient cree en presentiel sans email (voir WalkInPatientForm.jsx) -
 * une fois un vrai email ajoute ici, le patient peut utiliser "mot de
 * passe oublie" pour choisir lui-meme son mot de passe et acceder a la
 * plateforme.
 */
export default function CompleteRegistrationForm() {
  const [patientSearch, setPatientSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function searchPatients(e) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.get('/patients/establishment', { params: patientSearch ? { search: patientSearch } : {} })
      setPatients(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Recherche impossible.'))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!selectedPatientId || !email) {
      setError('Choisis un patient et indique son e-mail.')
      return
    }
    setSaving(true)
    try {
      await api.patch(`/patients/${selectedPatientId}/email`, { email })
      setMessage("Inscription complétée - le patient peut maintenant utiliser 'Mot de passe oublié' pour choisir son mot de passe et se connecter.")
      setEmail('')
      setSelectedPatientId('')
      setPatients([])
      setPatientSearch('')
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de compléter l'inscription de ce patient."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-forest-100 bg-white p-5">
      <p className="font-medium text-forest-900 mb-1">Compléter l'inscription d'un patient</p>
      <p className="text-forest-700 text-sm mb-4">
        Pour un patient créé sans e-mail lors d'une visite précédente, et qui souhaite désormais accéder lui-même à la plateforme.
      </p>

      {error && <p className="text-clay-600 text-sm mb-3">{error}</p>}
      {message && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-3 mb-3 text-sm">{message}</p>}

      <form onSubmit={searchPatients} className="flex gap-2 mb-3">
        <input
          value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)}
          placeholder="Rechercher le patient par nom..."
          className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-full border border-forest-300 px-4 py-2 text-sm hover:bg-forest-50 transition">
          Chercher
        </button>
      </form>

      {patients.length > 0 && (
        <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)}
          className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3 bg-white">
          <option value="">Choisis un patient...</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name} ({p.dossier_number})</option>
          ))}
        </select>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input type="email" required placeholder="E-mail du patient" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <button type="submit" disabled={saving}
          className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
          {saving ? '...' : 'Compléter'}
        </button>
      </form>
    </div>
  )
}
