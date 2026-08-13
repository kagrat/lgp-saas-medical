import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '../api/client'

const EQUIPMENT_STATUS_LABELS = {
  fonctionnel: 'Fonctionnel',
  maintenance: 'En maintenance',
  hors_service: 'Hors service',
}

export default function LabCatalogManager() {
  const [refValues, setRefValues] = useState([])
  const [equipment, setEquipment] = useState([])
  const [error, setError] = useState('')
  const [refForm, setRefForm] = useState({ test_name: '', unit: '', min_value: '', max_value: '', notes: '' })
  const [equipForm, setEquipForm] = useState({ name: '', status: 'fonctionnel', notes: '' })
  const [savingRef, setSavingRef] = useState(false)
  const [savingEquip, setSavingEquip] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [refRes, equipRes] = await Promise.all([
        api.get('/lab-catalog/reference-values/mine'),
        api.get('/lab-catalog/equipment/mine'),
      ])
      setRefValues(refRes.data)
      setEquipment(equipRes.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le catalogue.'))
    }
  }

  async function handleAddRef(e) {
    e.preventDefault()
    setError('')
    setSavingRef(true)
    try {
      await api.post('/lab-catalog/reference-values', {
        test_name: refForm.test_name,
        unit: refForm.unit || null,
        min_value: refForm.min_value ? Number(refForm.min_value) : null,
        max_value: refForm.max_value ? Number(refForm.max_value) : null,
        notes: refForm.notes || null,
      })
      setRefForm({ test_name: '', unit: '', min_value: '', max_value: '', notes: '' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter cette valeur de reference."))
    } finally {
      setSavingRef(false)
    }
  }

  async function handleDeleteRef(id) {
    try {
      await api.delete(`/lab-catalog/reference-values/${id}`)
      await load()
    } catch (err) {
      setError('Suppression impossible.')
    }
  }

  async function handleAddEquip(e) {
    e.preventDefault()
    setError('')
    setSavingEquip(true)
    try {
      await api.post('/lab-catalog/equipment', equipForm)
      setEquipForm({ name: '', status: 'fonctionnel', notes: '' })
      await load()
    } catch (err) {
      setError(getErrorMessage(err, "Impossible d'ajouter cet equipement."))
    } finally {
      setSavingEquip(false)
    }
  }

  async function handleDeleteEquip(id) {
    try {
      await api.delete(`/lab-catalog/equipment/${id}`)
      await load()
    } catch (err) {
      setError('Suppression impossible.')
    }
  }

  return (
    <div>
      {error && <p className="text-clay-600 mb-4">{error}</p>}

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Valeurs de reference</h3>
      <form onSubmit={handleAddRef} className="grid sm:grid-cols-2 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <input required placeholder="Nom de l'analyse (ex: Glycemie)" value={refForm.test_name}
          onChange={(e) => setRefForm({ ...refForm, test_name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input placeholder="Unite (ex: g/L)" value={refForm.unit}
          onChange={(e) => setRefForm({ ...refForm, unit: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input type="number" step="any" placeholder="Valeur min" value={refForm.min_value}
          onChange={(e) => setRefForm({ ...refForm, min_value: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input type="number" step="any" placeholder="Valeur max" value={refForm.max_value}
          onChange={(e) => setRefForm({ ...refForm, max_value: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <input placeholder="Notes (optionnel)" value={refForm.notes}
          onChange={(e) => setRefForm({ ...refForm, notes: e.target.value })}
          className="sm:col-span-2 rounded-lg border border-forest-100 px-3 py-2" />
        <button type="submit" disabled={savingRef}
          className="sm:col-span-2 rounded-full bg-forest-700 text-white py-2.5 font-medium hover:bg-forest-900 transition disabled:opacity-50">
          {savingRef ? 'Ajout...' : 'Ajouter cette valeur'}
        </button>
      </form>
      <div className="space-y-2 mb-8">
        {refValues.length === 0 && <p className="text-forest-700 text-sm">Aucune valeur de reference enregistree.</p>}
        {refValues.map((r) => (
          <div key={r.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">{r.test_name}</p>
              <p className="text-sm text-forest-700">
                {r.min_value ?? '?'} - {r.max_value ?? '?'} {r.unit || ''}
              </p>
            </div>
            <button onClick={() => handleDeleteRef(r.id)} className="text-sm text-clay-600 hover:underline">
              Supprimer
            </button>
          </div>
        ))}
      </div>

      <h3 className="font-display text-lg text-forest-900 font-semibold mb-3">Equipements</h3>
      <form onSubmit={handleAddEquip} className="grid sm:grid-cols-3 gap-3 bg-white border border-forest-100 rounded-xl p-5 mb-4">
        <input required placeholder="Nom de l'equipement" value={equipForm.name}
          onChange={(e) => setEquipForm({ ...equipForm, name: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <select value={equipForm.status} onChange={(e) => setEquipForm({ ...equipForm, status: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2 bg-white">
          {Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input placeholder="Notes (optionnel)" value={equipForm.notes}
          onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })}
          className="rounded-lg border border-forest-100 px-3 py-2" />
        <button type="submit" disabled={savingEquip}
          className="sm:col-span-3 rounded-full bg-forest-700 text-white py-2.5 font-medium hover:bg-forest-900 transition disabled:opacity-50">
          {savingEquip ? 'Ajout...' : "Ajouter cet equipement"}
        </button>
      </form>
      <div className="space-y-2">
        {equipment.length === 0 && <p className="text-forest-700 text-sm">Aucun equipement enregistre.</p>}
        {equipment.map((e) => (
          <div key={e.id} className="rounded-xl border border-forest-100 bg-white p-4 flex justify-between items-center">
            <div>
              <p className="text-forest-900 font-medium">{e.name}</p>
              <p className="text-sm text-forest-700">{EQUIPMENT_STATUS_LABELS[e.status] || e.status}</p>
            </div>
            <button onClick={() => handleDeleteEquip(e.id)} className="text-sm text-clay-600 hover:underline">
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
