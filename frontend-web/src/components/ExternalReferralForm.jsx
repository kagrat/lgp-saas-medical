import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (demande explicite de M. Faustin: "reorienter vers un autre
 * medecin interne ou externe... si l'hopital ne dispose pas en interne").
 * L'interne existait deja (transferer le rendez-vous a un confrere du
 * meme etablissement). Ceci couvre l'EXTERNE: recherche n'importe quel
 * medecin actif de la plateforme (nom, ville ou specialite - pas de
 * limite d'etablissement, verifie cote serveur) et lui transmet le
 * dossier du patient pour qu'il prenne le relais.
 */
export default function ExternalReferralForm({ patientId }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState({ name: '', city: '', specialty: '' })
  const [results, setResults] = useState(null)
  const [note, setNote] = useState('')
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSearch(e) {
    e.preventDefault()
    setSearching(true)
    setError('')
    try {
      const params = {}
      if (query.name) params.name = query.name
      if (query.city) params.city = query.city
      if (query.specialty) params.specialty = query.specialty
      const { data } = await api.get('/doctors/search', { params })
      setResults(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Recherche impossible.'))
    } finally {
      setSearching(false)
    }
  }

  async function handleSend(doctorId) {
    setSending(true)
    setError('')
    try {
      await api.post(`/doctors/me/patients/${patientId}/share`, { to_doctor_id: doctorId, note: note || null })
      setMessage('Dossier transmis à ce médecin externe.')
      setResults(null)
      setQuery({ name: '', city: '', specialty: '' })
      setNote('')
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de transmettre ce dossier."))
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-sm rounded-full border border-forest-300 text-forest-700 px-4 py-1.5 hover:bg-forest-50 transition">
        Réorienter vers un médecin externe
      </button>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-forest-100 w-full">
      <div className="flex justify-between items-center mb-2">
        <p className="text-sm font-medium text-forest-900">Réorienter vers un médecin externe</p>
        <button onClick={() => setOpen(false)} className="text-sm text-forest-700 hover:underline">Fermer</button>
      </div>
      {error && <p className="text-clay-600 text-sm mb-2">{error}</p>}
      {message && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-2 text-sm">{message}</p>}

      <form onSubmit={handleSearch} className="grid sm:grid-cols-3 gap-2 mb-3">
        <input placeholder="Nom du médecin" value={query.name}
          onChange={(e) => setQuery({ ...query, name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <input placeholder="Ville (ex: Porto-Novo)" value={query.city}
          onChange={(e) => setQuery({ ...query, city: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <input placeholder="Spécialité (ex: Cardiologie)" value={query.specialty}
          onChange={(e) => setQuery({ ...query, specialty: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <button type="submit" disabled={searching}
          className="sm:col-span-3 rounded-full border border-forest-300 py-1.5 text-sm hover:bg-forest-50 transition disabled:opacity-50">
          {searching ? 'Recherche...' : 'Chercher'}
        </button>
      </form>

      <input placeholder="Motif de la réorientation (optionnel)" value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3" />

      {results !== null && (
        results.length === 0 ? (
          <p className="text-sm text-forest-700">Aucun médecin trouvé.</p>
        ) : (
          <div className="space-y-1">
            {results.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-forest-100 p-2">
                <div>
                  <p className="text-sm text-forest-900 font-medium">{d.full_name}</p>
                  <p className="text-xs text-forest-700">{d.specialty}</p>
                </div>
                <button onClick={() => handleSend(d.id)} disabled={sending}
                  className="text-sm rounded-full bg-[var(--portal-accent)] text-white px-4 py-1.5 hover:brightness-90 transition disabled:opacity-50">
                  {sending ? '...' : 'Envoyer'}
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
