import { useState } from 'react'
import api, { getRole, getErrorMessage } from '../api/client'

export default function Laboratory() {
  const [city, setCity] = useState('')
  const [labs, setLabs] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [requestForm, setRequestForm] = useState({}) // lab_id -> { test_name, sample_type }
  const [requestingId, setRequestingId] = useState(null)
  const role = getRole()

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      const { data } = await api.get('/lab/search', { params: city ? { city } : {} })
      setLabs(data)
    } catch (err) {
      setError(getErrorMessage(err, 'La recherche a echoue.'))
    }
  }

  function updateForm(labId, field, value) {
    setRequestForm((forms) => ({ ...forms, [labId]: { ...forms[labId], [field]: value } }))
  }

  async function requestTest(lab) {
    if (role !== 'patient') {
      setError('Connecte-toi avec un compte patient pour demander une analyse.')
      return
    }
    const form = requestForm[lab.id]
    if (!form?.test_name) {
      setError('Precise le nom de l\'analyse souhaitee.')
      return
    }
    setRequestingId(lab.id)
    setError('')
    try {
      await api.post('/lab/tests', {
        establishment_id: lab.id,
        test_name: form.test_name,
        sample_type: form.sample_type || null,
      })
      setMessage(`Demande envoyee a ${lab.name}. Tu peux suivre son avancement dans ton espace patient.`)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible d\'envoyer cette demande.'))
    } finally {
      setRequestingId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-14">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Laboratoire</p>
      <h1 className="font-display text-4xl font-semibold text-forest-900 mb-6">
        Trouve un laboratoire adhérent et demande ton analyse.
      </h1>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          value={city} onChange={(e) => setCity(e.target.value)}
          placeholder="Ville (optionnel)..."
          className="flex-1 rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
        />
        <button type="submit" className="rounded-full bg-forest-700 text-white px-6 py-2.5 font-medium hover:bg-forest-900 transition">
          Rechercher
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}
      {message && <p className="text-forest-900 bg-forest-50 border border-forest-300 rounded-xl p-4 mb-6">{message}</p>}

      <div className="space-y-4">
        {labs.map((lab) => (
          <div key={lab.id} className="rounded-xl border border-forest-100 bg-white p-5">
            <p className="font-display text-lg text-forest-900 font-semibold">{lab.name}</p>
            <p className="text-sm text-forest-700 mb-3">{lab.city}{lab.address ? ` - ${lab.address}` : ''}</p>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <input
                placeholder="Nom de l'analyse (ex: NFS, Glycemie...)"
                value={requestForm[lab.id]?.test_name || ''}
                onChange={(e) => updateForm(lab.id, 'test_name', e.target.value)}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm"
              />
              <input
                placeholder="Type de prelevement (optionnel)"
                value={requestForm[lab.id]?.sample_type || ''}
                onChange={(e) => updateForm(lab.id, 'sample_type', e.target.value)}
                className="rounded-lg border border-forest-100 px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={() => requestTest(lab)}
              disabled={requestingId === lab.id}
              className="rounded-full bg-amber-500 text-forest-900 px-5 py-2 text-sm font-semibold hover:bg-amber-400 transition disabled:opacity-50"
            >
              {requestingId === lab.id ? 'Envoi...' : 'Demander cette analyse'}
            </button>
          </div>
        ))}
        {labs.length === 0 && <p className="text-forest-700">Lance une recherche pour voir les laboratoires disponibles.</p>}
      </div>
    </div>
  )
}
