import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null)
  const [establishments, setEstablishments] = useState([])
  const [error, setError] = useState('')
  const [newEstablishment, setNewEstablishment] = useState({
    name: '', type: 'hopital', city: '', address: '', latitude: '', longitude: '',
    admin_email: '', admin_password: '', admin_full_name: '',
  })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    try {
      const [statsRes, estRes] = await Promise.all([
        api.get('/dashboard/global'),
        api.get('/establishments'),
      ])
      setStats(statsRes.data)
      setEstablishments(estRes.data)
    } catch (err) {
      setError('Impossible de charger les donnees globales. Verifie ta session Super Admin.')
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/establishments', {
        ...newEstablishment,
        latitude: newEstablishment.latitude ? Number(newEstablishment.latitude) : null,
        longitude: newEstablishment.longitude ? Number(newEstablishment.longitude) : null,
      })
      setNewEstablishment({
        name: '', type: 'hopital', city: '', address: '', latitude: '', longitude: '',
        admin_email: '', admin_password: '', admin_full_name: '',
      })
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de creer cet etablissement."))
    }
  }

  async function toggleActive(establishment) {
    try {
      await api.patch(`/establishments/${establishment.id}/status`, { is_active: !establishment.is_active })
      await loadAll()
    } catch (err) {
      setError("Impossible de mettre a jour le statut.")
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <p className="text-amber-600 font-medium tracking-wide uppercase text-xs mb-3">Super Admin</p>
      <h1 className="font-display text-3xl font-semibold text-forest-900 mb-8">Vue globale de la plateforme</h1>

      {error && <p className="text-clay-600 mb-6">{error}</p>}

      {stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Etablissements" value={stats.total_establishments} />
          <StatCard label="Actifs" value={stats.active_establishments} />
          <StatCard label="Suspendus" value={stats.suspended_establishments} highlight={stats.suspended_establishments > 0} />
          <StatCard label="RDV totaux" value={stats.total_appointments} />
        </div>
      )}

      <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Ajouter un etablissement adherent</h2>
      <form onSubmit={handleCreate} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-10">
        <input required placeholder="Nom de l'etablissement" value={newEstablishment.name}
          onChange={(e) => setNewEstablishment({ ...newEstablishment, name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <select value={newEstablishment.type} onChange={(e) => setNewEstablishment({ ...newEstablishment, type: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2">
          <option value="hopital">Hopital</option>
          <option value="clinique">Clinique</option>
          <option value="pharmacie">Pharmacie</option>
        </select>
        <input required placeholder="Ville" value={newEstablishment.city}
          onChange={(e) => setNewEstablishment({ ...newEstablishment, city: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input placeholder="Adresse" value={newEstablishment.address}
          onChange={(e) => setNewEstablishment({ ...newEstablishment, address: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
          <input type="number" step="any" placeholder="Latitude (optionnel)" value={newEstablishment.latitude}
            onChange={(e) => setNewEstablishment({ ...newEstablishment, latitude: e.target.value })}
            className="rounded-lg border border-forest-100 px-3 py-2" />
          <input type="number" step="any" placeholder="Longitude (optionnel)" value={newEstablishment.longitude}
            onChange={(e) => setNewEstablishment({ ...newEstablishment, longitude: e.target.value })}
            className="rounded-lg border border-forest-100 px-3 py-2" />
        </div>
        <p className="sm:col-span-2 text-xs text-forest-700 -mt-2">
          Laisse vide pour utiliser la position approximative de la ville. Pour plus de precision,
          trouve les coordonnees exactes sur Google Maps (clic droit sur l'emplacement → copier les coordonnees).
        </p>
        <input required placeholder="Nom admin etablissement" value={newEstablishment.admin_full_name}
          onChange={(e) => setNewEstablishment({ ...newEstablishment, admin_full_name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input required type="email" placeholder="Email admin" value={newEstablishment.admin_email}
          onChange={(e) => setNewEstablishment({ ...newEstablishment, admin_email: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input required type="password" placeholder="Mot de passe temporaire" value={newEstablishment.admin_password}
          onChange={(e) => setNewEstablishment({ ...newEstablishment, admin_password: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 sm:col-span-2" />
        <button type="submit" className="sm:col-span-2 rounded-full bg-forest-700 text-white py-2.5 font-medium hover:bg-forest-900 transition">
          Creer l'etablissement
        </button>
      </form>

      <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Etablissements adherents</h2>
      <div className="space-y-2">
        {establishments.map((est) => (
          <div key={est.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">{est.name}</p>
              <p className="text-sm text-forest-700">{est.type} - {est.city} - {est.subscription_status}</p>
            </div>
            <button
              onClick={() => toggleActive(est)}
              className={`text-sm px-4 py-1.5 rounded-full font-medium transition ${
                est.is_active ? 'border border-clay-500 text-clay-600 hover:bg-clay-500 hover:text-white' : 'bg-forest-700 text-white hover:bg-forest-900'
              }`}
            >
              {est.is_active ? 'Suspendre' : 'Reactiver'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? 'border-clay-500 bg-clay-500/5' : 'border-forest-100 bg-white'}`}>
      <p className="text-sm text-forest-700 mb-1">{label}</p>
      <p className={`font-display text-3xl font-semibold ${highlight ? 'text-clay-600' : 'text-forest-900'}`}>{value}</p>
    </div>
  )
}
