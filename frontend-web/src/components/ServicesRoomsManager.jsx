import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function ServicesRoomsManager() {
  const [services, setServices] = useState([])
  const [rooms, setRooms] = useState([])
  const [error, setError] = useState('')
  const [serviceForm, setServiceForm] = useState({ name: '', price: '', duration_minutes: '', description: '' })
  const [roomForm, setRoomForm] = useState({ name: '', room_type: '', capacity: '' })
  const [savingService, setSavingService] = useState(false)
  const [savingRoom, setSavingRoom] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [servicesRes, roomsRes] = await Promise.all([
        api.get('/services/mine'),
        api.get('/services/rooms/mine'),
      ])
      setServices(servicesRes.data)
      setRooms(roomsRes.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les services et salles.'))
    }
  }

  async function handleAddService(e) {
    e.preventDefault()
    setError('')
    setSavingService(true)
    try {
      await api.post('/services', {
        name: serviceForm.name,
        price: Number(serviceForm.price),
        duration_minutes: serviceForm.duration_minutes ? Number(serviceForm.duration_minutes) : null,
        description: serviceForm.description || null,
      })
      setServiceForm({ name: '', price: '', duration_minutes: '', description: '' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter ce service."))
    } finally {
      setSavingService(false)
    }
  }

  async function handleDeleteService(id) {
    try {
      await api.delete(`/services/${id}`)
      await load()
    } catch (err) {
      setError('Suppression impossible.')
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
      })
      setRoomForm({ name: '', room_type: '', capacity: '' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter cette salle."))
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

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Services & tarifs</h3>
      <form onSubmit={handleAddService} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <input required placeholder="Nom du service (ex: Pansement)" value={serviceForm.name}
          onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input required type="number" placeholder="Prix (FCFA)" value={serviceForm.price}
          onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input type="number" placeholder="Duree (min, optionnel)" value={serviceForm.duration_minutes}
          onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input placeholder="Description (optionnel)" value={serviceForm.description}
          onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <button type="submit" disabled={savingService}
          className="sm:col-span-2 rounded-full bg-forest-700 text-white py-2.5 font-medium hover:bg-forest-900 transition disabled:opacity-50">
          {savingService ? 'Ajout...' : 'Ajouter ce service'}
        </button>
      </form>
      <div className="space-y-2 mb-8">
        {services.length === 0 && <p className="text-forest-700 text-sm">Aucun service enregistre.</p>}
        {services.map((s) => (
          <div key={s.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">{s.name}</p>
              <p className="text-sm text-forest-700">
                {s.price.toLocaleString('fr-FR')} FCFA{s.duration_minutes ? ` - ${s.duration_minutes} min` : ''}
              </p>
            </div>
            <button onClick={() => handleDeleteService(s.id)} className="text-sm text-clay-600 hover:underline">
              Supprimer
            </button>
          </div>
        ))}
      </div>

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Salles & ressources</h3>
      <form onSubmit={handleAddRoom} className="grid sm:grid-cols-3 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <input required placeholder="Nom (ex: Salle 1)" value={roomForm.name}
          onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input placeholder="Type (optionnel)" value={roomForm.room_type}
          onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input type="number" placeholder="Capacite (optionnel)" value={roomForm.capacity}
          onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <button type="submit" disabled={savingRoom}
          className="sm:col-span-3 rounded-full bg-forest-700 text-white py-2.5 font-medium hover:bg-forest-900 transition disabled:opacity-50">
          {savingRoom ? 'Ajout...' : 'Ajouter cette salle'}
        </button>
      </form>
      <div className="space-y-2">
        {rooms.length === 0 && <p className="text-forest-700 text-sm">Aucune salle enregistree.</p>}
        {rooms.map((r) => (
          <div key={r.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">{r.name}</p>
              <p className="text-sm text-forest-700">
                {r.room_type || ''}{r.capacity ? ` - Capacite: ${r.capacity}` : ''}
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
