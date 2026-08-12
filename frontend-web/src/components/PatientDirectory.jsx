import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function PatientDirectory() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load(query) {
    try {
      const { data } = await api.get('/patients/establishment', { params: query ? { search: query } : {} })
      setPatients(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le repertoire patients.'))
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    load(search)
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un patient par nom..."
          className="flex-1 rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
        />
        <button type="submit" className="rounded-full bg-forest-700 text-white px-6 py-2.5 font-medium hover:bg-forest-900 transition">
          Rechercher
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <div className="space-y-2">
        {patients.length === 0 && <p className="text-forest-700">Aucun patient trouve.</p>}
        {patients.map((p) => (
          <div key={p.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">{p.full_name}</p>
              <p className="text-sm text-forest-700">
                Dossier {p.dossier_number} - {p.email}{p.phone ? ` - ${p.phone}` : ''}
              </p>
            </div>
            {p.last_visit && (
              <p className="text-xs text-forest-700">
                Derniere visite: {new Date(p.last_visit).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
