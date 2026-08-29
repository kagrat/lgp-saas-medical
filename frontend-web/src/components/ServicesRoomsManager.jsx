import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

export default function ServicesRoomsManager() {
  const [services, setServices] = useState([])
  const [rooms, setRooms] = useState([])
  const [departments, setDepartments] = useState([])
  const [inventory, setInventory] = useState([])
  const [error, setError] = useState('')
  const [serviceForm, setServiceForm] = useState({ name: '', price: '', duration_minutes: '', description: '' })
  const [roomForm, setRoomForm] = useState({ name: '', room_type: '', capacity: '', department_id: '' })
  const [inventoryForm, setInventoryForm] = useState({ name: '', category: '', quantity: '', unit: '', alert_threshold: '5' })
  const [savingService, setSavingService] = useState(false)
  const [savingRoom, setSavingRoom] = useState(false)
  const [savingInventory, setSavingInventory] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [servicesRes, roomsRes, departmentsRes, inventoryRes] = await Promise.all([
        api.get('/services/mine'),
        api.get('/services/rooms/mine'),
        api.get('/establishments/departments'),
        api.get('/inventory/mine'),
      ])
      setServices(servicesRes.data)
      setRooms(roomsRes.data)
      setDepartments(departmentsRes.data)
      setInventory(inventoryRes.data)
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
        department_id: roomForm.department_id || null,
      })
      setRoomForm({ name: '', room_type: '', capacity: '', department_id: '' })
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

  async function handleAddInventory(e) {
    e.preventDefault()
    setError('')
    setSavingInventory(true)
    try {
      await api.post('/inventory', {
        name: inventoryForm.name,
        category: inventoryForm.category || null,
        quantity: Number(inventoryForm.quantity) || 0,
        unit: inventoryForm.unit || null,
        alert_threshold: Number(inventoryForm.alert_threshold) || 5,
      })
      setInventoryForm({ name: '', category: '', quantity: '', unit: '', alert_threshold: '5' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter cet article."))
    } finally {
      setSavingInventory(false)
    }
  }

  async function adjustInventoryQuantity(id, newQuantity) {
    try {
      await api.patch(`/inventory/${id}`, { quantity: Math.max(0, newQuantity) })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Mise a jour impossible.'))
    }
  }

  async function handleDeleteInventory(id) {
    try {
      await api.delete(`/inventory/${id}`)
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
          className="sm:col-span-2 rounded-full bg-primary-700 text-white py-2.5 font-medium hover:bg-primary-900 transition disabled:opacity-50">
          {savingService ? 'Ajout...' : 'Ajouter ce service'}
        </button>
      </form>
      <div className="space-y-2 mb-8">
        {services.length === 0 && <p className="text-forest-700 text-sm">Aucun service enregistré.</p>}
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
      <form onSubmit={handleAddRoom} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <input required placeholder="Nom (ex: Chambre 101)" value={roomForm.name}
          onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <select value={roomForm.department_id} onChange={(e) => setRoomForm({ ...roomForm, department_id: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 bg-white">
          <option value="">Departement (optionnel)</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input placeholder="Type (optionnel)" value={roomForm.room_type}
          onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input type="number" placeholder="Capacite (optionnel)" value={roomForm.capacity}
          onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <button type="submit" disabled={savingRoom}
          className="sm:col-span-2 rounded-full bg-primary-700 text-white py-2.5 font-medium hover:bg-primary-900 transition disabled:opacity-50">
          {savingRoom ? 'Ajout...' : 'Ajouter cette salle'}
        </button>
      </form>
      <div className="space-y-2">
        {rooms.length === 0 && <p className="text-forest-700 text-sm">Aucune salle enregistrée.</p>}
        {rooms.map((r) => (
          <div key={r.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">
                {r.name}
                {r.is_occupied && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-clay-500/10 text-clay-600 font-medium">Occupee</span>}
                {!r.is_occupied && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-success-500/10 text-success-700 font-medium">Libre</span>}
              </p>
              <p className="text-sm text-forest-700">
                {r.department_name ? `${r.department_name} - ` : ''}{r.room_type || ''}{r.capacity ? ` - Capacite: ${r.capacity}` : ''}
                {r.is_occupied && r.current_patient_name && ` - Patient: ${r.current_patient_name}`}
              </p>
            </div>
            <button onClick={() => handleDeleteRoom(r.id)} className="text-sm text-clay-600 hover:underline">
              Supprimer
            </button>
          </div>
        ))}
      </div>

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3 mt-8">Stock general (materiel, consommables)</h3>
      <form onSubmit={handleAddInventory} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <input required placeholder="Nom (ex: Gants latex)" value={inventoryForm.name}
          onChange={(e) => setInventoryForm({ ...inventoryForm, name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input placeholder="Categorie (optionnel)" value={inventoryForm.category}
          onChange={(e) => setInventoryForm({ ...inventoryForm, category: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input type="number" min="0" placeholder="Quantite" value={inventoryForm.quantity}
          onChange={(e) => setInventoryForm({ ...inventoryForm, quantity: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input placeholder="Unite (ex: boites)" value={inventoryForm.unit}
          onChange={(e) => setInventoryForm({ ...inventoryForm, unit: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <div className="sm:col-span-2">
          <label className="block text-xs text-forest-700 mb-1">Seuil d'alerte (notification automatique en dessous)</label>
          <input type="number" min="0" value={inventoryForm.alert_threshold}
            onChange={(e) => setInventoryForm({ ...inventoryForm, alert_threshold: e.target.value })}
            className="w-32 rounded-lg border border-forest-100 px-3 py-2" />
        </div>
        <button type="submit" disabled={savingInventory}
          className="sm:col-span-2 rounded-full bg-primary-700 text-white py-2.5 font-medium hover:bg-primary-900 transition disabled:opacity-50">
          {savingInventory ? 'Ajout...' : 'Ajouter cet article'}
        </button>
      </form>
      <div className="space-y-2">
        {inventory.length === 0 && <p className="text-forest-700 text-sm">Aucun article enregistré.</p>}
        {inventory.map((i) => (
          <div key={i.id} className={`rounded-xl border p-4 flex justify-between items-center ${i.is_low_stock ? 'border-clay-300 bg-clay-500/5' : 'border-forest-100 bg-white'}`}>
            <div>
              <p className="text-forest-900 font-medium">
                {i.name}
                {i.is_low_stock && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-clay-500/10 text-clay-600 font-medium">Stock bas</span>}
              </p>
              <p className="text-sm text-forest-700">
                {i.category ? `${i.category} - ` : ''}{i.quantity} {i.unit || 'unites'} (seuil: {i.alert_threshold})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => adjustInventoryQuantity(i.id, i.quantity - 1)} className="w-7 h-7 rounded-full border border-forest-100 text-forest-700 hover:bg-forest-50 transition">−</button>
              <button onClick={() => adjustInventoryQuantity(i.id, i.quantity + 1)} className="w-7 h-7 rounded-full border border-forest-100 text-forest-700 hover:bg-forest-50 transition">+</button>
              <button onClick={() => handleDeleteInventory(i.id)} className="text-sm text-clay-600 hover:underline ml-2">Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
