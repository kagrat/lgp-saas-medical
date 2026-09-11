import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

/**
 * NOUVEAU (demande explicite de M. Faustin: retirer l'option "Services"
 * du menu): l'ancien onglet "Services" melangeait 4 choses distinctes -
 * prestations facturables, chambres, departements et stock general.
 * Les prestations facturables sont retirees (pas d'usage clair identifie),
 * le stock general a rejoint l'onglet "Equipement" (qui l'utilisait deja
 * pour les commandes fournisseurs), et cet onglet devient uniquement
 * "Chambres et Lits" - la gestion des chambres reste essentielle pour
 * l'hospitalisation (deja utilisee par le module d'admission).
 */
export default function RoomsManager() {
  const [rooms, setRooms] = useState([])
  const [departments, setDepartments] = useState([])
  const [error, setError] = useState('')
  const [roomForm, setRoomForm] = useState({ name: '', room_type: '', capacity: '', department_id: '' })
  const [savingRoom, setSavingRoom] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [roomsRes, departmentsRes] = await Promise.all([
        api.get('/services/rooms/mine'),
        api.get('/establishments/departments'),
      ])
      setRooms(roomsRes.data)
      setDepartments(departmentsRes.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les chambres.'))
    }
  }

  async function handleAddRoom(e) {
    e.preventDefault()
    setError('')
    setSavingRoom(true)
    try {
      await api.post('/services/rooms', {
        name: roomForm.name,
        room_type: roomForm.room_type || null,
        capacity: roomForm.capacity ? Number(roomForm.capacity) : null,
        department_id: roomForm.department_id || null,
      })
      setRoomForm({ name: '', room_type: '', capacity: '', department_id: '' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter cette chambre."))
    } finally {
      setSavingRoom(false)
    }
  }

  async function handleDeleteRoom(id) {
    try {
      await api.delete(`/services/rooms/${id}`)
      await load()
    } catch (err) {
      setError('Suppression impossible.')
    }
  }

  return (
    <div>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <form onSubmit={handleAddRoom} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <input required placeholder="Nom (ex: Chambre 101)" value={roomForm.name}
          onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <select value={roomForm.department_id} onChange={(e) => setRoomForm({ ...roomForm, department_id: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 bg-white">
          <option value="">Département (optionnel)</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input placeholder="Type (optionnel)" value={roomForm.room_type}
          onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input type="number" min="1" placeholder="Capacité / nombre de lits (optionnel)" value={roomForm.capacity}
          onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <button type="submit" disabled={savingRoom}
          className="sm:col-span-2 rounded-full bg-[var(--portal-accent)] text-white py-2.5 font-medium hover:brightness-90 transition disabled:opacity-50">
          {savingRoom ? 'Ajout...' : 'Ajouter cette chambre'}
        </button>
      </form>

      <div className="space-y-2">
        {rooms.length === 0 && <p className="text-forest-700 text-sm">Aucune chambre enregistrée.</p>}
        {rooms.map((r) => (
          <div key={r.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">
                {r.name}
                {r.is_occupied && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-clay-500/10 text-clay-600 font-medium">Occupée</span>}
                {!r.is_occupied && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-success-500/10 text-success-700 font-medium">Libre</span>}
              </p>
              <p className="text-sm text-forest-700">
                {r.department_name ? `${r.department_name} - ` : ''}{r.room_type || ''}{r.capacity ? ` - Lits: ${r.capacity}` : ''}
                {r.is_occupied && r.current_patient_name && ` - Patient: ${r.current_patient_name}`}
              </p>
            </div>
            <button onClick={() => handleDeleteRoom(r.id)} className="text-sm text-clay-600 hover:underline">
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
