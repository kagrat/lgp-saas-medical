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
  // NOUVEAU (demande M. Faustin): plusieurs lignes d'analyses pour le
  // meme patient, ajoutees/retirees avant un seul envoi groupe - utile
  // pour un patient present sur place qui commande plusieurs analyses
  // a la fois (ex: glycemie + cholesterol + creatinine).
  const [tests, setTests] = useState([{ test_name: '', sample_type: '', priority: 'routine' }])
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

  function updateTest(idx, field, value) {
    setTests((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  function addTestRow() {
    setTests((rows) => [...rows, { test_name: '', sample_type: '', priority: 'routine' }])
  }

  function removeTestRow(idx) {
    setTests((rows) => rows.filter((_, i) => i !== idx))
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    const validTests = tests.filter((t) => t.test_name.trim())
    if (!selectedPatientId || validTests.length === 0) {
      setError('Choisis un patient et precise le nom d\'au moins une analyse.')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.post('/lab/tests/register', {
        patient_id: selectedPatientId,
        tests: validTests.map((t) => ({ test_name: t.test_name, sample_type: t.sample_type || null, priority: t.priority || 'routine' })),
      })
      setMessage(`${data.length} analyse${data.length > 1 ? 's' : ''} enregistree${data.length > 1 ? 's' : ''} - prelevement marque comme effectue.`)
      setTests([{ test_name: '', sample_type: '', priority: 'routine' }])
      if (onRegistered) onRegistered()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'enregistrer ces analyses."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-forest-100 bg-white p-5 mb-6">
      <p className="font-medium text-forest-900 mb-3">Enregistrer une ou plusieurs analyses pour un patient présent sur place</p>

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

      <p className="text-xs text-forest-700 mb-2">Analyses a enregistrer</p>
      <div className="space-y-2 mb-2">
        {tests.map((t, idx) => (
          <div key={idx} className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
            <input placeholder="Nom de l'analyse" value={t.test_name}
              onChange={(e) => updateTest(idx, 'test_name', e.target.value)}
              className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            <input placeholder="Type de prelevement (optionnel)" value={t.sample_type}
              onChange={(e) => updateTest(idx, 'sample_type', e.target.value)}
              className="rounded-lg border border-forest-100 px-3 py-2 text-sm" />
            <select value={t.priority} onChange={(e) => updateTest(idx, 'priority', e.target.value)}
              className={`rounded-lg border px-3 py-2 text-sm bg-white ${t.priority === 'urgent' ? 'border-clay-500 text-clay-600 font-medium' : 'border-forest-100'}`}>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
            </select>
            {tests.length > 1 && (
              <button type="button" onClick={() => removeTestRow(idx)} className="text-xs text-clay-600 hover:underline">
                Retirer
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addTestRow} className="text-xs text-[var(--portal-accent)] font-medium hover:underline mb-3">
        + Ajouter une autre analyse pour ce patient
      </button>

      {error && <p className="text-clay-600 text-sm mb-2">{error}</p>}
      {message && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-lg p-2 mb-2 text-sm">{message}</p>}

      <div>
        <button onClick={handleRegister} disabled={saving}
          className="rounded-full bg-[var(--portal-accent)] text-white px-5 py-2 text-sm font-medium hover:brightness-90 transition disabled:opacity-50">
          {saving ? 'Enregistrement...' : `Enregistrer ${tests.filter((t) => t.test_name.trim()).length > 1 ? 'ces analyses' : "l'analyse"}`}
        </button>
      </div>
    </div>
  )
}
