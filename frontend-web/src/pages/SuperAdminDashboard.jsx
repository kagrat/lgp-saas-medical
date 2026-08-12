import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'
import { RevenueTrendChart, AppointmentsTrendChart, TopEstablishmentsChart } from '../components/RevenueCharts'
import ActivityLog from '../components/ActivityLog'
import UserDirectory from '../components/UserDirectory'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState(null)
  const [establishments, setEstablishments] = useState([])
  const [error, setError] = useState('')
  const [newEstablishment, setNewEstablishment] = useState({
    name: '', type: 'hopital', city: '', address: '', latitude: '', longitude: '',
    admin_email: '', admin_password: '', admin_full_name: '',
  })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', type: 'hopital', city: '', address: '', latitude: '', longitude: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [showUsers, setShowUsers] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    try {
      const [statsRes, trendsRes, estRes] = await Promise.all([
        api.get('/dashboard/global'),
        api.get('/dashboard/global/trends', { params: { months: 6 } }),
        api.get('/establishments'),
      ])
      setStats(statsRes.data)
      setTrends(trendsRes.data)
      setEstablishments(estRes.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les donnees globales. Verifie ta session Super Admin.'))
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
      setError(getErrorMessage(err, "Impossible de mettre a jour le statut."))
    }
  }

  function startEdit(establishment) {
    setEditingId(establishment.id)
    setEditForm({
      name: establishment.name,
      type: establishment.type,
      city: establishment.city,
      address: establishment.address || '',
      latitude: establishment.latitude ?? '',
      longitude: establishment.longitude ?? '',
    })
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(establishmentId) {
    setSavingEdit(true)
    setError('')
    try {
      await api.patch(`/establishments/${establishmentId}`, {
        name: editForm.name,
        type: editForm.type,
        city: editForm.city,
        address: editForm.address || null,
        latitude: editForm.latitude !== '' ? Number(editForm.latitude) : null,
        longitude: editForm.longitude !== '' ? Number(editForm.longitude) : null,
      })
      setEditingId(null)
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible de modifier cet etablissement."))
    } finally {
      setSavingEdit(false)
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

      {trends && (
        <div className="mb-10">
          <h2 className="font-display text-xl font-semibold text-forest-900 mb-4">Analytics (6 derniers mois)</h2>
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <RevenueTrendChart data={trends.monthly} />
            <AppointmentsTrendChart data={trends.monthly} />
          </div>
          {trends.by_establishment.length > 0 && (
            <TopEstablishmentsChart data={trends.by_establishment} />
          )}
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
          <option value="laboratoire">Laboratoire</option>
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
          Laisse vide pour utiliser la position approximative de la ville.
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
      <div className="space-y-2 mb-10">
        {establishments.map((est) => (
          <div key={est.id} className="rounded-xl border border-forest-100 bg-white p-4">
            {editingId === est.id ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Nom" className="rounded-lg border border-forest-100 px-3 py-2" />
                <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  className="rounded-lg border border-forest-100 px-3 py-2">
                  <option value="hopital">Hopital</option>
                  <option value="clinique">Clinique</option>
                  <option value="pharmacie">Pharmacie</option>
                  <option value="laboratoire">Laboratoire</option>
                </select>
                <input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  placeholder="Ville" className="rounded-lg border border-forest-100 px-3 py-2" />
                <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Adresse" className="rounded-lg border border-forest-100 px-3 py-2" />
                <input type="number" step="any" value={editForm.latitude}
                  onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                  placeholder="Latitude" className="rounded-lg border border-forest-100 px-3 py-2" />
                <input type="number" step="any" value={editForm.longitude}
                  onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                  placeholder="Longitude" className="rounded-lg border border-forest-100 px-3 py-2" />
                <div className="sm:col-span-2 flex gap-2">
                  <button onClick={() => saveEdit(est.id)} disabled={savingEdit}
                    className="rounded-full bg-forest-700 text-white px-5 py-1.5 text-sm font-medium hover:bg-forest-900 transition disabled:opacity-50">
                    {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button onClick={cancelEdit}
                    className="rounded-full border border-forest-300 px-5 py-1.5 text-sm hover:bg-forest-50 transition">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-forest-900 font-medium">{est.name}</p>
                  <p className="text-sm text-forest-700">{est.type} - {est.city} - {est.subscription_status}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(est)}
                    className="text-sm px-4 py-1.5 rounded-full border border-forest-300 hover:bg-forest-50 transition">
                    Modifier
                  </button>
                  <button
                    onClick={() => toggleActive(est)}
                    className={`text-sm px-4 py-1.5 rounded-full font-medium transition ${
                      est.is_active ? 'border border-clay-500 text-clay-600 hover:bg-clay-500 hover:text-white' : 'bg-forest-700 text-white hover:bg-forest-900'
                    }`}
                  >
                    {est.is_active ? 'Suspendre' : 'Reactiver'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold text-forest-900">Utilisateurs de la plateforme</h2>
        <button onClick={() => setShowUsers(!showUsers)}
          className="text-sm rounded-full border border-forest-300 px-4 py-1.5 hover:bg-forest-50 transition">
          {showUsers ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      {showUsers && <div className="mb-10"><UserDirectory /></div>}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold text-forest-900">Journal d'activite</h2>
        <button onClick={() => setShowActivityLog(!showActivityLog)}
          className="text-sm rounded-full border border-forest-300 px-4 py-1.5 hover:bg-forest-50 transition">
          {showActivityLog ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      {showActivityLog && <ActivityLog />}
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
