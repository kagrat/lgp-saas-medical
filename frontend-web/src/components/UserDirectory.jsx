import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  establishment_admin: 'Admin établissement',
  doctor: 'Médecin',
  secretary: 'Secrétaire',
  pharmacist: 'Pharmacien',
  lab_technician: 'Technicien labo',
  patient: 'Patient',
}

export default function UserDirectory() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [togglingId, setTogglingId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load(query) {
    try {
      const { data } = await api.get('/users', { params: query ? { search: query } : {} })
      setUsers(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les utilisateurs.'))
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    load(search)
  }

  async function toggleActive(userId) {
    setTogglingId(userId)
    try {
      await api.patch(`/users/${userId}/toggle-active`)
      await load(search)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de mettre à jour ce compte.'))
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-3 mb-4">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un utilisateur par nom..."
          className="flex-1 rounded-lg border border-forest-100 px-4 py-2.5 focus:border-forest-500"
        />
        <button type="submit" className="rounded-full bg-primary-700 text-white px-6 py-2.5 font-medium hover:bg-primary-900 transition">
          Rechercher
        </button>
      </form>

      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-forest-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-forest-100 text-left text-forest-700">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Rôle</th>
              <th className="px-4 py-3 font-medium">Établissement</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-forest-50 last:border-0">
                <td className="px-4 py-3">
                  <p className="text-forest-900 font-medium">{u.full_name}</p>
                  <p className="text-xs text-forest-700">{u.email}</p>
                </td>
                <td className="px-4 py-3 text-forest-700">{ROLE_LABELS[u.role] || u.role}</td>
                <td className="px-4 py-3 text-forest-700">{u.establishment_name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${u.is_active ? 'bg-success-500/10 text-success-700' : 'bg-clay-500/10 text-clay-600'}`}>
                    {u.is_active ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(u.id)}
                    disabled={togglingId === u.id}
                    className="text-xs rounded-full border border-forest-300 px-3 py-1 hover:bg-forest-50 transition disabled:opacity-50"
                  >
                    {togglingId === u.id ? '...' : u.is_active ? 'Désactiver' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="text-forest-700 p-4">Aucun utilisateur trouvé.</p>}
      </div>
    </div>
  )
}
