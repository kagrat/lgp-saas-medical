import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export function LabStatsCards() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/lab/stats')
      .then(({ data }) => setStats(data))
      .catch((err) => setError(getErrorMessage(err, 'Impossible de charger les statistiques.')))
  }, [])

  if (error) return <p className="text-clay-600 mb-4">{error}</p>
  if (!stats) return null

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatBox label="Analyses totales" value={stats.total_tests} />
      <StatBox label="En attente" value={stats.pending_count} />
      <StatBox label="A valider" value={stats.to_validate_count} />
      <StatBox
        label="Taux de realisation"
        value={stats.completion_rate_pct !== null ? `${stats.completion_rate_pct}%` : '-'}
      />
      {stats.average_turnaround_days !== null && (
        <StatBox label="Delai moyen de rendu" value={`${stats.average_turnaround_days} j`} />
      )}
    </div>
  )
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-xl border border-forest-100 bg-white p-5">
      <p className="text-sm text-forest-700 mb-1">{label}</p>
      <p className="font-display text-2xl font-semibold text-forest-900">{value}</p>
    </div>
  )
}

export function RegisterTestByStaff({ onRegistered }) {
  const [patientSearch, setPatientSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [testName, setTestName] = useState('')
  const [sampleType, setSampleType] = useState('')
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

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!selectedPatientId || !testName) {
      setError('Choisis un patient et precise le nom de l\'analyse.')
      return
    }
    setSaving(true)
    try {
      await api.post('/lab/tests/register', {
        patient_id: selectedPatientId,
        test_name: testName,
        sample_type: sampleType || null,
      })
      setMessage('Analyse enregistree - prelevement marque comme effectue.')
      setTestName('')
      setSampleType('')
      if (onRegistered) onRegistered()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer cette analyse."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-forest-100 bg-white p-5 mb-6">
      <p className="font-medium text-forest-900 mb-3">Enregistrer une analyse pour un patient présent sur place</p>

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

      <div className="grid sm:grid-cols-2 gap-2 mb-3">
        <input placeholder="Nom de l'analyse" value={testName} onChange={(e) => setTestName(e.target.value)}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
        <input placeholder="Type de prelevement (optionnel)" value={sampleType} onChange={(e) => setSampleType(e.target.value)}
          className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
      </div>

      {error && <p className="text-clay-600 text-sm mb-2">{error}</p>}
      {message && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-2 text-sm">{message}</p>}

      <button onClick={handleRegister} disabled={saving}
        className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
        {saving ? 'Enregistrement...' : "Enregistrer l'analyse"}
      </button>
    </div>
  )
}
