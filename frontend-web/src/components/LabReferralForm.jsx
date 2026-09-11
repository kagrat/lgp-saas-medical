import { useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function LabReferralForm({ appointmentId, onDone }) {
  const [city, setCity] = useState('')
  const [labs, setLabs] = useState([])
  const [selectedLabId, setSelectedLabId] = useState('')
  const [testName, setTestName] = useState('')
  const [sampleType, setSampleType] = useState('')
  const [priority, setPriority] = useState('routine')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function searchLabs(e) {
    e.preventDefault()
    setError('')
    setSearching(true)
    try {
      const { data } = await api.get('/lab/search', { params: city ? { city } : {} })
      setLabs(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Recherche impossible.'))
    } finally {
      setSearching(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!selectedLabId || !testName) {
      setError('Choisis un laboratoire et precise le nom de l\'analyse.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/lab/tests/refer', {
        appointment_id: appointmentId,
        lab_establishment_id: selectedLabId,
        test_name: testName,
        sample_type: sampleType || null,
        priority,
      })
      setMessage('Analyse transmise au laboratoire. Le patient la voit deja dans son suivi.')
      setTestName('')
      setSampleType('')
      setPriority('routine')
      if (onDone) onDone()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de transmettre cette analyse."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-forest-100">
      <p className="text-sm font-medium text-forest-900 mb-3">Orienter ce patient vers un laboratoire</p>

      <form onSubmit={searchLabs} className="flex gap-2 mb-3">
        <input
          value={city} onChange={(e) => setCity(e.target.value)}
          placeholder="Ville du laboratoire..."
          className="flex-1 rounded-lg border border-forest-100 px-3 py-2 text-sm"
        />
        <button type="submit" disabled={searching} className="rounded-full border border-forest-300 px-4 py-2 text-sm hover:bg-forest-50 transition disabled:opacity-50">
          {searching ? '...' : 'Chercher'}
        </button>
      </form>

      {labs.length > 0 && (
        <select value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)}
          className="w-full rounded-lg border border-forest-100 px-3 py-2 text-sm mb-3 bg-white">
          <option value="">Choisis un laboratoire...</option>
          {labs.map((l) => (
            <option key={l.id} value={l.id}>{l.name} - {l.city}</option>
          ))}
        </select>
      )}

      <div className="grid sm:grid-cols-3 gap-2 mb-3">
        <input placeholder="Nom de l'analyse" value={testName} onChange={(e) => setTestName(e.target.value)}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <input placeholder="Type de prelevement (optionnel)" value={sampleType} onChange={(e) => setSampleType(e.target.value)}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}
          className={`rounded-lg border px-3 py-2 text-sm bg-white ${priority === 'urgent' ? 'border-clay-500 text-clay-600 font-medium' : 'border-forest-100'}`}>
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {error && <p className="text-clay-600 text-sm mb-2">{error}</p>}
      {message && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-2 text-sm">{message}</p>}

      <button onClick={handleSubmit} disabled={submitting}
        className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
        {submitting ? 'Envoi...' : 'Transmettre au laboratoire'}
      </button>
    </div>
  )
}
